"""Quick Timer - Schedule one-time actions for any entity."""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    SERVICE_TOGGLE,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
)
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    callback,
)
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import (
    async_track_point_in_time,
)
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .const import (
    ATTR_AT_TIME,
    ATTR_DELAY,
    ATTR_ENTITY_ID,
    ATTR_FINISH_ACTIONS,
    ATTR_NOTIFY,
    ATTR_NOTIFY_HA,
    ATTR_NOTIFY_MOBILE,
    ATTR_NOTIFY_DEVICES,
    ATTR_PREFERENCES,
    ATTR_START_ACTIONS,
    ATTR_TASK_ID,
    ATTR_TASK_LABEL,
    ATTR_TIME_MODE,
    ATTR_UNIT,
    DOMAIN,
    EVENT_TASK_CANCELLED,
    EVENT_TASK_COMPLETED,
    EVENT_TASK_STARTED,
    SERVICE_CANCEL_ACTION,
    SERVICE_GET_PREFERENCES,
    SERVICE_RUN_ACTION,
    SERVICE_SET_PREFERENCES,
    TIME_MODE_ABSOLUTE,
    TIME_MODE_RELATIVE,
    UNIT_HOURS,
    UNIT_MINUTES,
    UNIT_SECONDS,
    # Legacy imports for backward compatibility
    ATTR_ACTION,
    ATTR_RUN_NOW,
    ATTR_SERVICE,
    ATTR_SERVICE_DATA,
)
from .store import QuickTimerStore, QuickTimerPreferencesStore

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

# Allow configuration via configuration.yaml (optional)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Service schemas
RUN_ACTION_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_TASK_ID): cv.string,  # Unique ID for scoped tasks
        vol.Optional(ATTR_ENTITY_ID): cv.entity_id,  # Legacy support
        vol.Optional(ATTR_DELAY): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=86400)
        ),
        vol.Optional(ATTR_UNIT, default=UNIT_MINUTES): vol.In([UNIT_SECONDS, UNIT_MINUTES, UNIT_HOURS]),
        vol.Optional(ATTR_TASK_LABEL): cv.string,  # Human-readable label for overview
        vol.Optional(ATTR_START_ACTIONS): vol.All(cv.ensure_list, [dict]),  # Execute on start (optional)
        vol.Optional(ATTR_FINISH_ACTIONS): vol.All(cv.ensure_list, [dict]),  # Execute on finish (required, optional for legacy)
        vol.Optional(ATTR_NOTIFY, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_HA, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_MOBILE, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_DEVICES): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(ATTR_AT_TIME): cv.string,  # HH:MM format for absolute time
        vol.Optional(ATTR_TIME_MODE, default=TIME_MODE_RELATIVE): vol.In([TIME_MODE_RELATIVE, TIME_MODE_ABSOLUTE]),
        # Legacy fields for backward compatibility
        vol.Optional(ATTR_ACTION): cv.string,
        vol.Optional(ATTR_SERVICE): cv.string,
        vol.Optional(ATTR_SERVICE_DATA): dict,
        vol.Optional(ATTR_RUN_NOW): cv.boolean,
    }
)


def convert_to_seconds(delay: int, unit: str) -> int:
    """Convert delay to seconds based on unit."""
    if unit == UNIT_SECONDS:
        return delay
    elif unit == UNIT_HOURS:
        return delay * 3600
    else:  # default minutes
        return delay * 60


CANCEL_ACTION_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_TASK_ID): cv.string,  # Task ID for scoped cancellation
        vol.Optional(ATTR_ENTITY_ID): cv.entity_id,  # Legacy support
    }
)

GET_PREFERENCES_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_ENTITY_ID): cv.entity_id,
    }
)

SET_PREFERENCES_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Required(ATTR_PREFERENCES): dict,
    }
)


class QuickTimerCoordinator:
    """Coordinator for Quick Timer."""

    def __init__(self, hass: HomeAssistant, store: QuickTimerStore, preferences_store: QuickTimerPreferencesStore) -> None:
        """Initialize the coordinator."""
        self.hass = hass
        self.store = store
        self.preferences_store = preferences_store
        self._scheduled_tasks: dict[str, Any] = {}
        self._state_listeners: dict[str, Any] = {}
        self._sensor: Any = None

    def register_sensor(self, sensor) -> None:
        """Register the monitoring sensor."""
        self._sensor = sensor

    def unregister_sensor(self) -> None:
        """Unregister the monitoring sensor."""
        self._sensor = None

    def get_all_tasks(self) -> dict[str, Any]:
        """Get all scheduled tasks."""
        return self.store.get_all_tasks()

    def get_all_preferences(self) -> dict[str, Any]:
        """Get all preferences."""
        return self.preferences_store.get_all_preferences()

    @callback
    def _update_sensor(self) -> None:
        """Update the sensor with current tasks."""
        if self._sensor is not None:
            self._sensor.update_tasks(self.store.get_all_tasks())

    @callback
    def _update_preferences_sensor(self) -> None:
        """Update the sensor with current preferences."""
        if self._sensor is not None:
            self._sensor.update_preferences(self.preferences_store.get_all_preferences())

    async def async_schedule_action(
        self,
        task_id: str,
        delay: int,
        unit: str,
        finish_actions: list[dict[str, Any]],
        start_actions: list[dict[str, Any]] | None = None,
        notify: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        notify_devices: list[str] | None = None,
        at_time: str | None = None,
        time_mode: str = TIME_MODE_RELATIVE,
        task_label: str | None = None,
    ) -> None:
        """Schedule a task with start_actions (optional) and finish_actions (required)."""
        # Cancel any existing task with this ID
        await self.async_cancel_action(task_id, silent=True)

        now = dt_util.now()
        
        # Calculate scheduled time based on mode
        if time_mode == TIME_MODE_ABSOLUTE and at_time:
            # Parse absolute time (HH:MM or HH:MM:SS format)
            try:
                parts = at_time.split(':')
                hours, minutes = int(parts[0]), int(parts[1])
                seconds = int(parts[2]) if len(parts) > 2 else 0
                scheduled_time = now.replace(hour=hours, minute=minutes, second=seconds, microsecond=0)
                
                # Handle crossing midnight - if the time is in the past, schedule for tomorrow
                if scheduled_time <= now:
                    scheduled_time = scheduled_time + timedelta(days=1)
                    _LOGGER.info(
                        "Scheduled time %s is in the past, scheduling for tomorrow",
                        at_time,
                    )
                
                delay_seconds = int((scheduled_time - now).total_seconds())
            except (ValueError, AttributeError) as err:
                _LOGGER.error("Invalid at_time format '%s': %s", at_time, err)
                return
        else:
            # Relative time mode (original behavior)
            delay_seconds = convert_to_seconds(delay, unit)
            scheduled_time = now + timedelta(seconds=delay_seconds)

        scheduled_time_str = now.isoformat()
        end_time_str = scheduled_time.isoformat()

        # Execute start actions immediately (if any)
        if start_actions:
            _LOGGER.info("Executing %d start actions for task %s", len(start_actions), task_id)
            for idx, action_def in enumerate(start_actions):
                try:
                    await self._execute_action_definition(action_def)
                except Exception as err:
                    _LOGGER.error("Start action %d failed for task %s: %s", idx, task_id, err)

        # Store the task
        await self.store.async_add_task(
            task_id=task_id,
            scheduled_time=scheduled_time_str,
            end_time=end_time_str,
            delay_seconds=delay_seconds,
            start_actions=start_actions or [],
            finish_actions=finish_actions,
            notify=notify,
            notify_ha=notify_ha,
            notify_mobile=notify_mobile,
            notify_devices=notify_devices or [],
            at_time=at_time,
            time_mode=time_mode,
            task_label=task_label,
        )

        # Schedule the finish actions
        cancel_callback = async_track_point_in_time(
            self.hass,
            self._create_finish_actions_callback(
                task_id=task_id,
                finish_actions=finish_actions,
                notify=notify,
                notify_ha=notify_ha,
                notify_mobile=notify_mobile,
                notify_devices=notify_devices,
                task_label=task_label,
            ),
            scheduled_time,
        )
        self._scheduled_tasks[task_id] = cancel_callback

        # Fire event
        self.hass.bus.async_fire(
            EVENT_TASK_STARTED,
            {
                "task_id": task_id,
                "start_actions": start_actions or [],
                "finish_actions": finish_actions,
                "scheduled_time": scheduled_time_str,
                "end_time": end_time_str,
                "delay_seconds": delay_seconds,
            },
        )

        # Add history entry for the primary target entity
        if finish_actions:
            primary_entity = finish_actions[0].get("target", {}).get("entity_id", task_id)
            await self.preferences_store.async_add_to_history(
                primary_entity,
                {
                    "delay": delay,
                    "unit": unit,
                    "time_mode": time_mode,
                    "at_time": at_time,
                    "start_actions": start_actions or [],
                    "finish_actions": finish_actions,
                },
            )
            self._update_preferences_sensor()

        # Update sensor
        self._update_sensor()

        # Send notification if enabled
        # if notify_ha or notify_mobile or notify_devices:
        #     display_name = task_label or task_id
        #     if time_mode == TIME_MODE_ABSOLUTE and at_time:
        #         time_str = f"at {at_time}"
        #     else:
        #         time_str = self._format_delay(delay, unit)
        #     await self._send_notification(
        #         f"Timer Started: {display_name}",
        #         f"Will complete {time_str} ({scheduled_time.strftime('%H:%M:%S')})",
        #         notify_ha=notify_ha,
        #         notify_mobile=notify_mobile,
        #         notify_devices=notify_devices,
        #     )

        _LOGGER.info(
            "Scheduled task %s at %s (in %d seconds, time_mode=%s)",
            task_id,
            end_time_str,
            delay_seconds,
            time_mode,
        )

    async def _execute_action_definition(self, action_def: dict[str, Any]) -> None:
        """Execute a single action definition from an action array.
        
        Action format: {"service": "domain.service", "target": {...}, "data": {...}}
        """
        service = action_def.get("service")
        if not service:
            _LOGGER.error("Action definition missing 'service' field: %s", action_def)
            return

        target = action_def.get("target", {})
        data = action_def.get("data", {})

        # Parse service
        if "." in service:
            domain, service_name = service.split(".", 1)
        else:
            _LOGGER.error("Invalid service format '%s': must be 'domain.service'", service)
            return

        try:
            await self.hass.services.async_call(
                domain,
                service_name,
                data or None,
                blocking=True,
                target=target or None,
            )
            _LOGGER.info("Executed %s.%s with data=%s, target=%s", domain, service_name, data, target)
        except Exception as err:
            _LOGGER.error("Failed to execute %s: %s", service, err)
            raise

    async def _execute_immediate_action(self, entity_id: str, action: str) -> None:
        """Execute an immediate action (legacy compatibility) - deprecated."""
        await self._execute_action(entity_id, action=action)

    def _map_legacy_action(self, entity_id: str, action: str) -> tuple[str, str, dict]:
        """Map legacy action string to (domain, service_name, extra_data)."""
        domain = entity_id.split(".")[0]
        extra_data: dict = {}

        if action in ("on", "turn_on"):
            return domain, SERVICE_TURN_ON, extra_data
        if action in ("off", "turn_off"):
            return domain, SERVICE_TURN_OFF, extra_data
        if action in ("toggle",):
            return domain, SERVICE_TOGGLE, extra_data
        if action in ("open_cover", "close_cover", "stop_cover"):
            return "cover", action, extra_data
        if action in ("media_play", "media_stop"):
            return "media_player", action, extra_data
        if action in ("start", "return_to_base"):
            return "vacuum", action, extra_data
        if action.startswith("set_hvac_mode_"):
            hvac_mode = action.replace("set_hvac_mode_", "")
            extra_data["hvac_mode"] = hvac_mode
            return "climate", "set_hvac_mode", extra_data
        # Fallback: treat as service name on the entity's domain
        return domain, action, extra_data

    async def _execute_action(
        self,
        entity_id: str,
        action: str | None = None,
        service: str | None = None,
        service_data: dict | None = None,
    ) -> None:
        """Execute an action/service on an entity (universal)."""
        call_data = dict(service_data) if service_data else {}
        call_data[ATTR_ENTITY_ID] = entity_id

        if service:
            # Universal mode: "domain.service_name" or just "service_name"
            if "." in service:
                svc_domain, svc_name = service.split(".", 1)
            else:
                svc_domain = entity_id.split(".")[0]
                svc_name = service
        elif action:
            # Legacy mode: map action constant to domain.service
            svc_domain, svc_name, extra = self._map_legacy_action(entity_id, action)
            call_data.update(extra)
        else:
            _LOGGER.error("Neither 'service' nor 'action' provided for %s", entity_id)
            return

        try:
            await self.hass.services.async_call(
                svc_domain,
                svc_name,
                call_data,
                blocking=True,
            )
            _LOGGER.info(
                "Executed %s.%s for %s", svc_domain, svc_name, entity_id,
            )
        except Exception as err:
            _LOGGER.error(
                "Failed to execute %s.%s for %s: %s", svc_domain, svc_name, entity_id, err,
            )

    def _format_delay(self, delay: int, unit: str) -> str:
        """Format delay for display."""
        if unit == UNIT_SECONDS:
            return f"{delay} seconds"
        elif unit == UNIT_HOURS:
            return f"{delay} hours"
        else:
            return f"{delay} minutes"

    def _create_finish_actions_callback(
        self,
        task_id: str,
        finish_actions: list[dict[str, Any]],
        notify: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        notify_devices: list[str] | None = None,
        task_label: str | None = None,
    ):
        """Create a callback for executing finish actions when timer completes."""
        display_name = task_label or task_id

        async def execute_finish_actions(now) -> None:
            """Execute all finish actions."""
            _LOGGER.info("Executing %d finish actions for task %s", len(finish_actions), task_id)

            success_count = 0
            error_count = 0

            for idx, action_def in enumerate(finish_actions):
                try:
                    await self._execute_action_definition(action_def)
                    success_count += 1
                except Exception as err:
                    _LOGGER.error("Finish action %d failed for task %s: %s", idx, task_id, err)
                    error_count += 1

            # Fire completion event
            self.hass.bus.async_fire(
                EVENT_TASK_COMPLETED,
                {
                    "task_id": task_id,
                    "finish_actions": finish_actions,
                    "success_count": success_count,
                    "error_count": error_count,
                },
            )

            # Send notification if enabled
            if notify_ha or notify_mobile or notify_devices:
                if error_count > 0:
                    await self._send_notification(
                        f"Timer Completed: {display_name}",
                        f"{success_count} actions succeeded, {error_count} failed",
                        notify_ha=notify_ha,
                        notify_mobile=notify_mobile,
                        notify_devices=notify_devices,
                    )
                else:
                    await self._send_notification(
                        f"Timer Completed: {display_name}",
                        f"All {success_count} actions executed successfully",
                        notify_ha=notify_ha,
                        notify_mobile=notify_mobile,
                        notify_devices=notify_devices,
                    )

            # Clean up
            await self._cleanup_task(task_id)

        return execute_finish_actions

    async def _cleanup_task(self, task_id: str) -> None:
        """Clean up a completed or cancelled task."""
        # Remove from scheduled tasks
        if task_id in self._scheduled_tasks:
            del self._scheduled_tasks[task_id]

        # Remove state listener (if any)
        if task_id in self._state_listeners:
            self._state_listeners[task_id]()
            del self._state_listeners[task_id]

        # Remove from store
        await self.store.async_remove_task(task_id)

        # Update sensor
        self._update_sensor()

    async def async_shutdown(self) -> None:
        """Cancel all in-memory callbacks without removing tasks from storage.
        
        Used during HA shutdown/restart to stop callbacks while preserving
        stored tasks for restoration after restart.
        """
        # Cancel all scheduled callbacks
        for entity_id in list(self._scheduled_tasks.keys()):
            try:
                self._scheduled_tasks[entity_id]()
            except Exception:  # noqa: BLE001
                pass
        self._scheduled_tasks.clear()

        # Remove all state listeners
        for entity_id in list(self._state_listeners.keys()):
            try:
                self._state_listeners[entity_id]()
            except Exception:  # noqa: BLE001
                pass
        self._state_listeners.clear()

        _LOGGER.info("Quick Timer shutdown: cancelled all in-memory callbacks, tasks preserved in storage")

    async def async_cancel_action(
        self, task_id: str, silent: bool = False, reason: str = "user_request"
    ) -> bool:
        """Cancel a scheduled task."""
        if task_id not in self._scheduled_tasks and not self.store.has_task(task_id):
            if not silent:
                _LOGGER.debug("No scheduled task found for %s", task_id)
            return False

        # Cancel the scheduled callback
        if task_id in self._scheduled_tasks:
            self._scheduled_tasks[task_id]()

        task = self.store.get_task(task_id)

        # Clean up
        await self._cleanup_task(task_id)

        # Fire cancellation event
        self.hass.bus.async_fire(
            EVENT_TASK_CANCELLED,
            {
                "task_id": task_id,
                "reason": reason,
            },
        )

        if not silent and task and (task.get("notify_ha", False) or task.get("notify_mobile", False) or task.get("notify", False) or task.get("notify_devices")):
            display_name = task.get("task_label") or task_id
            await self._send_notification(
                f"Timer Cancelled: {display_name}",
                f"Scheduled task was cancelled ({reason})",
                notify_ha=task.get("notify_ha", task.get("notify", False)),
                notify_mobile=task.get("notify_mobile", False),
                notify_devices=task.get("notify_devices"),
            )

        _LOGGER.info("Cancelled scheduled task %s (reason: %s)", task_id, reason)
        return True

    async def _send_notification(
        self, 
        title: str, 
        message: str,
        notify_ha: bool = True,
        notify_mobile: bool = False,
        notify_devices: list[str] | None = None,
    ) -> None:
        """Send notifications (HA persistent and/or mobile push)."""
        # HA Persistent Notification
        if notify_ha:
            try:
                await self.hass.services.async_call(
                    "persistent_notification",
                    "create",
                    {
                        "title": title,
                        "message": message,
                        "notification_id": f"quick_timer_{hash(title + message) % 10000}",
                    },
                )
            except Exception as err:
                _LOGGER.warning("Failed to send HA notification: %s", err)

        # Mobile Push Notification — specific devices or all
        if notify_devices:
            await self._send_mobile_notification(title, message, device_ids=notify_devices)
        elif notify_mobile:
            await self._send_mobile_notification(title, message)

    async def _send_mobile_notification(
        self, title: str, message: str, device_ids: list[str] | None = None
    ) -> None:
        """Send mobile push notification to specific devices or all mobile apps.

        Strategy for targeted notifications:
        A. Find a notify entity for the device → notify.send_message (modern HA)
        B. Guess service name via slugify(device.name) or identifier → notify.mobile_app_* (legacy)

        Broadcast mode iterates all registered notify.mobile_app_* services.
        """
        try:
            from homeassistant.helpers import device_registry as dr
            from homeassistant.helpers import entity_registry as er

            notify_data = {
                "title": title,
                "message": message,
                "data": {"tag": "quick_timer", "importance": "high"},
            }

            # ── 1. Targeted: specific device_ids selected ──
            if device_ids:
                dev_registry = dr.async_get(self.hass)
                ent_registry = er.async_get(self.hass)

                for device_id in device_ids:
                    device = dev_registry.async_get(device_id)
                    if not device:
                        _LOGGER.warning("Device %s not found in registry", device_id)
                        continue

                    # Strategy A: Find a notify entity for this device
                    notify_entity_id = None
                    for entry in ent_registry.entities.values():
                        if (
                            entry.domain == "notify"
                            and entry.device_id == device_id
                            and entry.disabled_by is None
                        ):
                            notify_entity_id = entry.entity_id
                            break

                    if notify_entity_id:
                        try:
                            await self.hass.services.async_call(
                                "notify",
                                "send_message",
                                {"message": message, "title": title},
                                target={"entity_id": notify_entity_id},
                            )
                            _LOGGER.info(
                                "Notification sent via entity %s (device %s)",
                                notify_entity_id, device.name,
                            )
                            continue
                        except Exception as e:
                            _LOGGER.warning(
                                "send_message to %s failed: %s, trying fallback service",
                                notify_entity_id, e,
                            )

                    # Strategy B: Guess service name from device name / identifier
                    service_candidates = []

                    if device.name:
                        safe_name = slugify(device.name)
                        service_candidates.append(f"mobile_app_{safe_name}")
                        service_candidates.append(f"mobile_app_{safe_name.replace('-', '_')}")

                    for id_domain, identifier in device.identifiers:
                        if id_domain == "mobile_app":
                            service_candidates.append(f"mobile_app_{identifier}")

                    service_called = False
                    for service_name in service_candidates:
                        if self.hass.services.has_service("notify", service_name):
                            try:
                                await self.hass.services.async_call(
                                    "notify", service_name, notify_data
                                )
                                _LOGGER.info(
                                    "Notification sent via service notify.%s (device %s)",
                                    service_name, device.name,
                                )
                                service_called = True
                                break
                            except Exception as e:
                                _LOGGER.error(
                                    "Service notify.%s failed: %s", service_name, e
                                )

                    if not service_called:
                        _LOGGER.error(
                            "Could not send notification to device %s (%s): "
                            "No matching notify entity or mobile_app_* service found. "
                            "Checked services: %s",
                            device_id, device.name, service_candidates,
                        )

            # ── 2. Broadcast: send to all mobile_app devices ──
            else:
                services = self.hass.services.async_services()
                notify_services = services.get("notify", {})

                sent_count = 0
                for service_name in notify_services:
                    if service_name.startswith("mobile_app_"):
                        try:
                            await self.hass.services.async_call(
                                "notify", service_name, notify_data
                            )
                            sent_count += 1
                        except Exception as e:
                            _LOGGER.warning(
                                "Broadcast to notify.%s failed: %s", service_name, e
                            )

                if sent_count == 0:
                    # Fallback: try entity-based broadcast
                    _LOGGER.warning("No mobile_app_* services found, trying entity-based broadcast")
                    ent_registry = er.async_get(self.hass)
                    all_notify_entities = [
                        entry.entity_id
                        for entry in ent_registry.entities.values()
                        if entry.domain == "notify"
                        and entry.disabled_by is None
                        and entry.device_id
                    ]
                    if all_notify_entities:
                        try:
                            await self.hass.services.async_call(
                                "notify",
                                "send_message",
                                {"message": message, "title": title},
                                target={"entity_id": all_notify_entities},
                            )
                            _LOGGER.info(
                                "Broadcast via send_message to %d entities",
                                len(all_notify_entities),
                            )
                        except Exception as e:
                            _LOGGER.error("Entity-based broadcast failed: %s", e)
                    else:
                        _LOGGER.error("No notify entities or services found for broadcast")

        except Exception as err:
            _LOGGER.error(
                "Failed to send mobile notification: %s", err, exc_info=True
            )

    async def async_restore_tasks(self) -> None:
        """Restore scheduled tasks after HA restart."""
        tasks = self.store.get_all_tasks()
        now = dt_util.now()

        for task_id, task in list(tasks.items()):
            end_time_str = task.get("end_time") or task.get("scheduled_time")
            scheduled_time = dt_util.parse_datetime(end_time_str) if end_time_str else None

            if scheduled_time is None:
                _LOGGER.warning("Invalid scheduled time for task %s, removing", task_id)
                await self.store.async_remove_task(task_id)
                continue

            finish_actions = task.get("finish_actions", [])
            if not finish_actions:
                _LOGGER.warning("Task %s has no finish_actions, removing", task_id)
                await self.store.async_remove_task(task_id)
                continue

            if scheduled_time <= now:
                # Task should have already executed, execute it now
                _LOGGER.info(
                    "Executing missed task %s (was scheduled for %s)",
                    task_id,
                    end_time_str,
                )
                callback_fn = self._create_finish_actions_callback(
                    task_id=task_id,
                    finish_actions=finish_actions,
                    notify=task.get("notify", False),
                    notify_ha=task.get("notify_ha", False),
                    notify_mobile=task.get("notify_mobile", False),
                    notify_devices=task.get("notify_devices"),
                    task_label=task.get("task_label"),
                )
                await callback_fn(now)
            else:
                # Reschedule the task
                _LOGGER.info(
                    "Restoring scheduled task %s at %s",
                    task_id,
                    end_time_str,
                )
                cancel_callback = async_track_point_in_time(
                    self.hass,
                    self._create_finish_actions_callback(
                        task_id=task_id,
                        finish_actions=finish_actions,
                        notify=task.get("notify", False),
                        notify_ha=task.get("notify_ha", False),
                        notify_mobile=task.get("notify_mobile", False),
                        notify_devices=task.get("notify_devices"),
                        task_label=task.get("task_label"),
                    ),
                    scheduled_time,
                )
                self._scheduled_tasks[task_id] = cancel_callback

        self._update_sensor()


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Quick Timer component."""
    hass.data.setdefault(DOMAIN, {})
    
    # Initialize storage early so services work
    store = QuickTimerStore(hass)
    await store.async_load()
    
    # Initialize preferences storage
    preferences_store = QuickTimerPreferencesStore(hass)
    await preferences_store.async_load()
    
    # Create coordinator
    coordinator = QuickTimerCoordinator(hass, store, preferences_store)
    hass.data[DOMAIN]["coordinator"] = coordinator
    hass.data[DOMAIN]["store"] = store
    hass.data[DOMAIN]["preferences_store"] = preferences_store
    
    # Restore tasks from storage
    await coordinator.async_restore_tasks()
    
    # Register services immediately so they are available
    async def handle_run_action(call: ServiceCall) -> None:
        """Handle the run_action service call."""
        coord = hass.data[DOMAIN].get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
            return

        # New architecture: task_id + start_actions + finish_actions
        task_id = call.data.get(ATTR_TASK_ID)
        entity_id = call.data.get(ATTR_ENTITY_ID)
        delay = call.data.get(ATTR_DELAY, 15)
        unit = call.data.get(ATTR_UNIT, UNIT_MINUTES)
        start_actions = call.data.get(ATTR_START_ACTIONS)
        finish_actions = call.data.get(ATTR_FINISH_ACTIONS)
        notify = call.data.get(ATTR_NOTIFY, False)
        notify_ha = call.data.get(ATTR_NOTIFY_HA, False)
        notify_mobile = call.data.get(ATTR_NOTIFY_MOBILE, False)
        notify_devices = call.data.get(ATTR_NOTIFY_DEVICES, [])
        task_label = call.data.get(ATTR_TASK_LABEL)
        at_time = call.data.get(ATTR_AT_TIME)
        time_mode = call.data.get(ATTR_TIME_MODE, TIME_MODE_RELATIVE)

        # Legacy support: convert old action/service parameters to action arrays
        if not finish_actions:
            action = call.data.get(ATTR_ACTION)
            service = call.data.get(ATTR_SERVICE)
            service_data = call.data.get(ATTR_SERVICE_DATA, {})
            run_now = call.data.get(ATTR_RUN_NOW, False)

            if not action and not service:
                _LOGGER.error("Either 'finish_actions' or legacy 'action'/'service' must be provided")
                return

            # Convert legacy parameters to action format
            if not entity_id:
                _LOGGER.error("'entity_id' is required for legacy mode")
                return

            # Build finish_actions from legacy parameters
            if service:
                finish_service = service
            elif action:
                # Map legacy action to service
                domain = entity_id.split(".")[0]
                if action in ("on", "turn_on"):
                    finish_service = f"{domain}.turn_on"
                elif action in ("off", "turn_off"):
                    finish_service = f"{domain}.turn_off"
                elif action == "toggle":
                    finish_service = f"{domain}.toggle"
                else:
                    finish_service = f"{domain}.{action}"
            else:
                _LOGGER.error("No valid action or service provided")
                return

            finish_actions = [{
                "service": finish_service,
                "target": {"entity_id": entity_id},
                "data": service_data or {},
            }]

            # Handle run_now logic (legacy)
            if run_now:
                _LOGGER.warning("run_now is deprecated. Use start_actions instead.")
                start_actions = finish_actions  # Execute immediately
                # For reverse, just turn off (simplified)
                finish_actions = [{
                    "service": f"{entity_id.split('.')[0]}.turn_off",
                    "target": {"entity_id": entity_id},
                    "data": {},
                }]

        # Default task_id to entity_id for backward compatibility
        if not task_id:
            if entity_id:
                task_id = entity_id
            else:
                # Generate task_id from finish_actions
                import hashlib
                task_str = str(finish_actions)
                task_id = f"task_{hashlib.md5(task_str.encode()).hexdigest()[:8]}"

        await coord.async_schedule_action(
            task_id=task_id,
            delay=delay,
            unit=unit,
            finish_actions=finish_actions,
            start_actions=start_actions,
            notify=notify,
            notify_ha=notify_ha,
            notify_mobile=notify_mobile,
            notify_devices=notify_devices,
            at_time=at_time,
            time_mode=time_mode,
            task_label=task_label,
        )

    async def handle_cancel_action(call: ServiceCall) -> None:
        """Handle the cancel_action service call."""
        coord = hass.data[DOMAIN].get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
            return
            
        task_id = call.data.get(ATTR_TASK_ID)
        entity_id = call.data.get(ATTR_ENTITY_ID)
        
        # Default to entity_id for backward compatibility
        if not task_id and entity_id:
            task_id = entity_id
        
        if not task_id:
            _LOGGER.error("Either 'task_id' or 'entity_id' must be provided")
            return
            
        await coord.async_cancel_action(task_id)

    async def handle_get_preferences(call: ServiceCall) -> dict:
        """Handle the get_preferences service call."""
        coord = hass.data[DOMAIN].get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
            return {}
        
        entity_id = call.data.get(ATTR_ENTITY_ID)
        if entity_id:
            return coord.preferences_store.get_preferences(entity_id)
        else:
            return coord.preferences_store.get_all_preferences()

    async def handle_set_preferences(call: ServiceCall) -> None:
        """Handle the set_preferences service call."""
        coord = hass.data[DOMAIN].get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
            return
        
        entity_id = call.data[ATTR_ENTITY_ID]
        preferences = call.data[ATTR_PREFERENCES]
        _LOGGER.info("Setting preferences for %s: %s", entity_id, preferences)
        
        # Use coordinator's preferences_store to ensure consistency
        await coord.preferences_store.async_set_preferences(entity_id, preferences)
        _LOGGER.info("Preferences saved, updating sensor...")
        
        # Update sensor with new preferences
        coord._update_preferences_sensor()
        _LOGGER.info("Sensor updated with new preferences")

    # Only register if not already registered
    if not hass.services.has_service(DOMAIN, SERVICE_RUN_ACTION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_RUN_ACTION,
            handle_run_action,
            schema=RUN_ACTION_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_CANCEL_ACTION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_CANCEL_ACTION,
            handle_cancel_action,
            schema=CANCEL_ACTION_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_GET_PREFERENCES):
        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_PREFERENCES,
            handle_get_preferences,
            schema=GET_PREFERENCES_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_PREFERENCES):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_PREFERENCES,
            handle_set_preferences,
            schema=SET_PREFERENCES_SCHEMA,
        )
    
    _LOGGER.info("Quick Timer services registered successfully")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Quick Timer from a config entry."""
    # Ensure async_setup was called
    if DOMAIN not in hass.data:
        await async_setup(hass, {})
    
    # Initialize storage if not already done
    if "store" not in hass.data[DOMAIN]:
        store = QuickTimerStore(hass)
        await store.async_load()
        preferences_store = QuickTimerPreferencesStore(hass)
        await preferences_store.async_load()
        coordinator = QuickTimerCoordinator(hass, store, preferences_store)
        hass.data[DOMAIN]["coordinator"] = coordinator
        hass.data[DOMAIN]["store"] = store
        hass.data[DOMAIN]["preferences_store"] = preferences_store
        await coordinator.async_restore_tasks()

    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Unload platforms
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        # Shutdown coordinator: cancel in-memory callbacks but preserve tasks in storage
        # so they can be restored after HA restart
        coordinator = hass.data[DOMAIN].get("coordinator")
        if coordinator:
            await coordinator.async_shutdown()

        # Note: We don't remove services here as they are registered in async_setup
        # and should remain available

    return unload_ok
