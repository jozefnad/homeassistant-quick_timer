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
    STATE_OFF,
    STATE_ON,
)
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    callback,
)
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from .const import (
    ACTION_OFF,
    ACTION_ON,
    ACTION_TOGGLE,
    ATTR_ACTION,
    ATTR_AT_TIME,
    ATTR_DELAY,
    ATTR_ENTITY_ID,
    ATTR_NOTIFY,
    ATTR_NOTIFY_HA,
    ATTR_NOTIFY_MOBILE,
    ATTR_PREFERENCES,
    ATTR_RUN_NOW,
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
    VALID_ACTIONS,
)
from .store import QuickTimerStore, QuickTimerPreferencesStore

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

# Allow configuration via configuration.yaml (optional)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Service schemas
RUN_ACTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Optional(ATTR_DELAY): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=86400)
        ),
        vol.Optional(ATTR_UNIT, default=UNIT_MINUTES): vol.In([UNIT_SECONDS, UNIT_MINUTES, UNIT_HOURS]),
        vol.Required(ATTR_ACTION): vol.In(VALID_ACTIONS),
        vol.Optional(ATTR_NOTIFY, default=False): cv.boolean,
        vol.Optional(ATTR_RUN_NOW, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_HA, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_MOBILE, default=False): cv.boolean,
        vol.Optional(ATTR_AT_TIME): cv.string,  # HH:MM format for absolute time
        vol.Optional(ATTR_TIME_MODE, default=TIME_MODE_RELATIVE): vol.In([TIME_MODE_RELATIVE, TIME_MODE_ABSOLUTE]),
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


def get_reverse_action(action: str) -> str:
    """Get the reverse action for run_now mode."""
    if action == ACTION_ON:
        return ACTION_OFF
    elif action == ACTION_OFF:
        return ACTION_ON
    return ACTION_TOGGLE

CANCEL_ACTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
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
        entity_id: str,
        delay: int,
        unit: str,
        action: str,
        notify: bool = False,
        run_now: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        at_time: str | None = None,
        time_mode: str = TIME_MODE_RELATIVE,
    ) -> None:
        """Schedule an action for an entity."""
        # Cancel any existing task for this entity
        await self.async_cancel_action(entity_id, silent=True)

        now = dt_util.now()
        
        # Calculate scheduled time based on mode
        if time_mode == TIME_MODE_ABSOLUTE and at_time:
            # Parse absolute time (HH:MM format)
            try:
                hours, minutes = map(int, at_time.split(':'))
                scheduled_time = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
                
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

        # Determine the actual action to schedule
        actual_action = action
        original_action = None

        if run_now:
            # Execute immediate action
            original_action = action
            actual_action = get_reverse_action(action)
            await self._execute_action(entity_id, action)

        # Store the task
        await self.store.async_add_task(
            entity_id=entity_id,
            action=actual_action,
            scheduled_time=scheduled_time_str,
            end_time=end_time_str,
            delay_seconds=delay_seconds,
            notify=notify,
            notify_ha=notify_ha,
            notify_mobile=notify_mobile,
            run_now=run_now,
            original_action=original_action,
            at_time=at_time,
            time_mode=time_mode,
        )

        # Add to history for persistence
        history_entry = {
            "action": action,
            "time_mode": time_mode,
            "timestamp": now.isoformat(),
        }
        if time_mode == TIME_MODE_ABSOLUTE:
            history_entry["at_time"] = at_time
        else:
            history_entry["delay"] = delay
            history_entry["unit"] = unit
        
        await self.preferences_store.async_add_to_history(entity_id, history_entry)
        
        # Save current preferences
        await self.preferences_store.async_set_preferences(
            entity_id,
            {
                "last_action": action,
                "last_time_mode": time_mode,
                "last_delay": delay,
                "last_unit": unit,
                "last_at_time": at_time,
                "notify_ha": notify_ha,
                "notify_mobile": notify_mobile,
            }
        )
        
        # Update preferences sensor
        self._update_preferences_sensor()

        # Schedule the action
        cancel_callback = async_track_point_in_time(
            self.hass,
            self._create_action_callback(
                entity_id=entity_id, 
                action=actual_action, 
                notify=notify,
                notify_ha=notify_ha,
                notify_mobile=notify_mobile,
            ),
            scheduled_time,
        )
        self._scheduled_tasks[entity_id] = cancel_callback

        # Listen for state changes to auto-cancel if user manually changes state
        # (only if not run_now mode, as run_now expects the state to change)
        if not run_now:
            self._setup_state_listener(entity_id, actual_action)

        # Fire event
        self.hass.bus.async_fire(
            EVENT_TASK_STARTED,
            {
                "entity_id": entity_id,
                "action": actual_action,
                "scheduled_time": scheduled_time_str,
                "end_time": end_time_str,
                "delay_seconds": delay_seconds,
                "run_now": run_now,
            },
        )

        # Update sensor
        self._update_sensor()

        # Send notification if enabled
        if notify_ha or notify_mobile:
            if time_mode == TIME_MODE_ABSOLUTE and at_time:
                time_str = f"at {at_time}"
            else:
                time_str = self._format_delay(delay, unit)
            if run_now:
                await self._send_notification(
                    f"Turned on: {entity_id}",
                    f"Will automatically turn off in {time_str}",
                    notify_ha=notify_ha,
                    notify_mobile=notify_mobile,
                )
            else:
                await self._send_notification(
                    f"Scheduled: {action.upper()} for {entity_id}",
                    f"Will execute at {scheduled_time.strftime('%H:%M:%S')}",
                    notify_ha=notify_ha,
                    notify_mobile=notify_mobile,
                )

        _LOGGER.info(
            "Scheduled %s for %s at %s (in %d seconds, run_now=%s, time_mode=%s)",
            actual_action,
            entity_id,
            end_time_str,
            delay_seconds,
            run_now,
            time_mode,
        )

    async def _execute_immediate_action(self, entity_id: str, action: str) -> None:
        """Execute an immediate action (for run_now mode) - legacy wrapper."""
        await self._execute_action(entity_id, action)

    async def _execute_action(self, entity_id: str, action: str) -> None:
        """Execute an action based on entity domain and action type."""
        domain = entity_id.split(".")[0]
        service = None
        service_data = {ATTR_ENTITY_ID: entity_id}

        # Map actions to domain services
        if action == ACTION_ON:
            service = SERVICE_TURN_ON
        elif action == ACTION_OFF:
            service = SERVICE_TURN_OFF
        elif action == ACTION_TOGGLE:
            service = SERVICE_TOGGLE
        elif action == "turn_off":
            service = SERVICE_TURN_OFF
        # Cover actions
        elif action == "open_cover":
            domain = "cover"
            service = "open_cover"
        elif action == "close_cover":
            domain = "cover"
            service = "close_cover"
        elif action == "stop_cover":
            domain = "cover"
            service = "stop_cover"
        # Media player actions
        elif action == "media_play":
            domain = "media_player"
            service = "media_play"
        elif action == "media_stop":
            domain = "media_player"
            service = "media_stop"
        # Vacuum actions
        elif action == "start":
            domain = "vacuum"
            service = "start"
        elif action == "return_to_base":
            domain = "vacuum"
            service = "return_to_base"
        # Climate actions
        elif action == "set_hvac_mode_heat":
            domain = "climate"
            service = "set_hvac_mode"
            service_data["hvac_mode"] = "heat"
        elif action == "set_hvac_mode_cool":
            domain = "climate"
            service = "set_hvac_mode"
            service_data["hvac_mode"] = "cool"
        elif action == "set_hvac_mode_auto":
            domain = "climate"
            service = "set_hvac_mode"
            service_data["hvac_mode"] = "auto"
        else:
            # Fallback to toggle
            service = SERVICE_TOGGLE

        try:
            await self.hass.services.async_call(
                domain,
                service,
                service_data,
                blocking=True,
            )
            _LOGGER.info("Executed action %s (service: %s.%s) for %s", action, domain, service, entity_id)
        except Exception as err:
            _LOGGER.error("Failed to execute action %s for %s: %s", action, entity_id, err)

    def _format_delay(self, delay: int, unit: str) -> str:
        """Format delay for display."""
        if unit == UNIT_SECONDS:
            return f"{delay} seconds"
        elif unit == UNIT_HOURS:
            return f"{delay} hours"
        else:
            return f"{delay} minutes"

    def _setup_state_listener(self, entity_id: str, scheduled_action: str) -> None:
        """Set up a state change listener to auto-cancel redundant tasks."""
        
        @callback
        def state_change_listener(event) -> None:
            """Handle state change events."""
            new_state = event.data.get("new_state")
            old_state = event.data.get("old_state")

            if new_state is None or old_state is None:
                return

            new_state_value = new_state.state
            old_state_value = old_state.state

            # Check if the manual change makes the scheduled action redundant
            should_cancel = False

            if scheduled_action == ACTION_ON and new_state_value == STATE_ON:
                should_cancel = True
                _LOGGER.info(
                    "Entity %s was manually turned ON, cancelling scheduled ON action",
                    entity_id,
                )
            elif scheduled_action == ACTION_OFF and new_state_value == STATE_OFF:
                should_cancel = True
                _LOGGER.info(
                    "Entity %s was manually turned OFF, cancelling scheduled OFF action",
                    entity_id,
                )
            elif scheduled_action == ACTION_TOGGLE:
                # For toggle, cancel if state changed manually
                if new_state_value != old_state_value:
                    should_cancel = True
                    _LOGGER.info(
                        "Entity %s state was manually changed, cancelling scheduled TOGGLE action",
                        entity_id,
                    )

            if should_cancel:
                self.hass.async_create_task(
                    self.async_cancel_action(entity_id, reason="manual_state_change")
                )

        # Remove any existing listener
        if entity_id in self._state_listeners:
            self._state_listeners[entity_id]()

        # Set up new listener
        self._state_listeners[entity_id] = async_track_state_change_event(
            self.hass, [entity_id], state_change_listener
        )

    def _create_action_callback(
        self, 
        entity_id: str, 
        action: str, 
        notify: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
    ):
        """Create a callback for the scheduled action."""

        async def execute_action(now) -> None:
            """Execute the scheduled action."""
            _LOGGER.info("Executing scheduled action %s for %s", action, entity_id)

            try:
                # Use the universal action executor
                await self._execute_action(entity_id, action)

                # Fire completion event
                self.hass.bus.async_fire(
                    EVENT_TASK_COMPLETED,
                    {
                        "entity_id": entity_id,
                        "action": action,
                    },
                )

                # Send notification if enabled
                if notify_ha or notify_mobile:
                    await self._send_notification(
                        f"Executed: {action.upper()} for {entity_id}",
                        "Scheduled action completed successfully",
                        notify_ha=notify_ha,
                        notify_mobile=notify_mobile,
                    )

            except Exception as err:
                _LOGGER.error(
                    "Failed to execute action %s for %s: %s",
                    action,
                    entity_id,
                    err,
                )
                if notify_ha or notify_mobile:
                    await self._send_notification(
                        f"Error: {action.upper()} for {entity_id}",
                        f"Action failed: {err}",
                        notify_ha=notify_ha,
                        notify_mobile=notify_mobile,
                    )

            # Clean up
            await self._cleanup_task(entity_id)

        return execute_action

    async def _cleanup_task(self, entity_id: str) -> None:
        """Clean up a completed or cancelled task."""
        # Remove from scheduled tasks
        if entity_id in self._scheduled_tasks:
            del self._scheduled_tasks[entity_id]

        # Remove state listener
        if entity_id in self._state_listeners:
            self._state_listeners[entity_id]()
            del self._state_listeners[entity_id]

        # Remove from store
        await self.store.async_remove_task(entity_id)

        # Update sensor
        self._update_sensor()

    async def async_cancel_action(
        self, entity_id: str, silent: bool = False, reason: str = "user_request"
    ) -> bool:
        """Cancel a scheduled action."""
        if entity_id not in self._scheduled_tasks and not self.store.has_task(entity_id):
            if not silent:
                _LOGGER.debug("No scheduled task found for %s", entity_id)
            return False

        # Cancel the scheduled callback
        if entity_id in self._scheduled_tasks:
            self._scheduled_tasks[entity_id]()

        task = self.store.get_task(entity_id)

        # Clean up
        await self._cleanup_task(entity_id)

        # Fire cancellation event
        self.hass.bus.async_fire(
            EVENT_TASK_CANCELLED,
            {
                "entity_id": entity_id,
                "reason": reason,
            },
        )

        if not silent and task and task.get("notify", True):
            if reason == "manual_state_change":
                await self._send_notification(
                    f"Auto-cancelled: {entity_id}",
                    "Scheduled action was cancelled because state was changed manually",
                )
            else:
                await self._send_notification(
                    f"Cancelled: {entity_id}",
                    "Scheduled action was cancelled",
                )

        _LOGGER.info("Cancelled scheduled action for %s (reason: %s)", entity_id, reason)
        return True

    async def _send_notification(
        self, 
        title: str, 
        message: str,
        notify_ha: bool = True,
        notify_mobile: bool = False,
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

        # Mobile Push Notification
        if notify_mobile:
            await self._send_mobile_notification(title, message)

    async def _send_mobile_notification(self, title: str, message: str) -> None:
        """Send mobile push notification to all registered mobile apps."""
        try:
            # Find all mobile app notify services
            services = self.hass.services.async_services()
            notify_services = services.get("notify", {})
            
            mobile_services = [
                svc for svc in notify_services.keys() 
                if svc.startswith("mobile_app_")
            ]
            
            for service_name in mobile_services:
                try:
                    await self.hass.services.async_call(
                        "notify",
                        service_name,
                        {
                            "title": title,
                            "message": message,
                            "data": {
                                "tag": "quick_timer",
                                "importance": "high",
                            },
                        },
                    )
                    _LOGGER.debug("Sent mobile notification to %s", service_name)
                except Exception as err:
                    _LOGGER.warning("Failed to send notification to %s: %s", service_name, err)
                    
            if not mobile_services:
                _LOGGER.debug("No mobile app notify services found")
                
        except Exception as err:
            _LOGGER.warning("Failed to send mobile notifications: %s", err)

    async def async_restore_tasks(self) -> None:
        """Restore scheduled tasks after HA restart."""
        tasks = self.store.get_all_tasks()
        now = dt_util.now()

        for entity_id, task in list(tasks.items()):
            end_time_str = task.get("end_time") or task.get("scheduled_time")
            scheduled_time = dt_util.parse_datetime(end_time_str) if end_time_str else None

            if scheduled_time is None:
                _LOGGER.warning("Invalid scheduled time for %s, removing task", entity_id)
                await self.store.async_remove_task(entity_id)
                continue

            if scheduled_time <= now:
                # Task should have already executed, execute it now
                _LOGGER.info(
                    "Executing missed task for %s (was scheduled for %s)",
                    entity_id,
                    end_time_str,
                )
                callback_fn = self._create_action_callback(
                    entity_id, task["action"], task.get("notify", True)
                )
                await callback_fn(now)
            else:
                # Reschedule the task
                _LOGGER.info(
                    "Restoring scheduled task for %s at %s",
                    entity_id,
                    end_time_str,
                )
                cancel_callback = async_track_point_in_time(
                    self.hass,
                    self._create_action_callback(
                        entity_id, task["action"], task.get("notify", True)
                    ),
                    scheduled_time,
                )
                self._scheduled_tasks[entity_id] = cancel_callback

                # Only set up state listener if not run_now mode
                if not task.get("run_now", False):
                    self._setup_state_listener(entity_id, task["action"])

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

        entity_id = call.data[ATTR_ENTITY_ID]
        delay = call.data.get(ATTR_DELAY, 15)
        unit = call.data.get(ATTR_UNIT, UNIT_MINUTES)
        action = call.data[ATTR_ACTION]
        notify = call.data.get(ATTR_NOTIFY, False)
        run_now = call.data.get(ATTR_RUN_NOW, False)
        notify_ha = call.data.get(ATTR_NOTIFY_HA, False)
        notify_mobile = call.data.get(ATTR_NOTIFY_MOBILE, False)
        at_time = call.data.get(ATTR_AT_TIME)
        time_mode = call.data.get(ATTR_TIME_MODE, TIME_MODE_RELATIVE)

        await coord.async_schedule_action(
            entity_id=entity_id,
            delay=delay,
            unit=unit,
            action=action,
            notify=notify,
            run_now=run_now,
            notify_ha=notify_ha,
            notify_mobile=notify_mobile,
            at_time=at_time,
            time_mode=time_mode,
        )

    async def handle_cancel_action(call: ServiceCall) -> None:
        """Handle the cancel_action service call."""
        coord = hass.data[DOMAIN].get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
            return
            
        entity_id = call.data[ATTR_ENTITY_ID]
        await coord.async_cancel_action(entity_id)

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
        # Cancel all scheduled tasks
        coordinator = hass.data[DOMAIN].get("coordinator")
        if coordinator:
            for entity_id in list(coordinator._scheduled_tasks.keys()):
                await coordinator.async_cancel_action(entity_id, silent=True)

        # Note: We don't remove services here as they are registered in async_setup
        # and should remain available

    return unload_ok
