"""Quick Timer - Schedule one-time actions for any entity."""
from __future__ import annotations

import copy
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import (
    Context,
    HomeAssistant,
    ServiceCall,
    callback,
)
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import (
    async_track_point_in_time,
)
from homeassistant.helpers.start import async_at_started
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
    ATTR_REVERT,
    ATTR_REVERT_ENTITIES,
    ATTR_START_ACTIONS,
    ATTR_TASK_ID,
    ATTR_TASK_LABEL,
    ATTR_TIME_MODE,
    ATTR_UNIT,
    DOMAIN,
    EVENT_TASK_CANCELLED,
    EVENT_TASK_COMPLETED,
    EVENT_TASK_PAUSED,
    EVENT_TASK_RESUMED,
    EVENT_TASK_STARTED,
    REVERT_BOTH,
    REVERT_OFF,
    REVERT_ON_CANCEL,
    REVERT_ON_FINISH,
    SERVICE_CANCEL_ACTION,
    SERVICE_GET_PREFERENCES,
    SERVICE_PAUSE_ACTION,
    SERVICE_RESUME_ACTION,
    SERVICE_RUN_ACTION,
    SERVICE_SET_PREFERENCES,
    TIME_MODE_ABSOLUTE,
    TIME_MODE_RELATIVE,
    UNIT_HOURS,
    UNIT_MINUTES,
    UNIT_SECONDS,
)
from .store import QuickTimerStore, QuickTimerPreferencesStore

from .frontend import async_register_frontend # Import frontend registration function for automatic resource registration and dialog injection

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

# Allow configuration via configuration.yaml (optional)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Service data keys whose current value lives in the entity *state* rather than
# in an attribute (e.g. select.select_option -> option, climate.set_hvac_mode ->
# hvac_mode). Used to build targeted revert actions.
_STATE_BACKED_KEYS = {"hvac_mode", "option", "value"}


def _parse_at_time(value: Any) -> tuple[int, int, int]:
    """Parse 'HH:MM' or 'HH:MM:SS' into (hours, minutes, seconds)."""
    try:
        parts = [int(p) for p in str(value).strip().split(":")]
    except (TypeError, ValueError) as err:
        raise vol.Invalid(f"Invalid at_time '{value}', expected HH:MM or HH:MM:SS") from err
    if len(parts) not in (2, 3):
        raise vol.Invalid(f"Invalid at_time '{value}', expected HH:MM or HH:MM:SS")
    hours, minutes = parts[0], parts[1]
    seconds = parts[2] if len(parts) == 3 else 0
    if not (0 <= hours <= 23 and 0 <= minutes <= 59 and 0 <= seconds <= 59):
        raise vol.Invalid(f"Invalid at_time '{value}', time out of range")
    return hours, minutes, seconds


def _validate_at_time(value: Any) -> str:
    """Voluptuous validator for at_time."""
    _parse_at_time(value)
    return str(value).strip()


def _target_entity_ids(action_def: dict[str, Any]) -> list[str]:
    """Return the entity_ids targeted by an action definition."""
    entity_id = (action_def.get("target") or {}).get("entity_id")
    if not entity_id:
        return []
    if isinstance(entity_id, str):
        return [entity_id]
    return [eid for eid in entity_id if eid]

# Service schemas
RUN_ACTION_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_TASK_ID): cv.string,  # Unique ID for scoped tasks
        vol.Optional(ATTR_DELAY): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=86400)
        ),
        vol.Optional(ATTR_UNIT, default=UNIT_MINUTES): vol.In([UNIT_SECONDS, UNIT_MINUTES, UNIT_HOURS]),
        vol.Optional(ATTR_TASK_LABEL): cv.string,  # Human-readable label for overview
        vol.Optional(ATTR_START_ACTIONS): vol.All(cv.ensure_list, [dict]),  # Execute on start (optional)
        vol.Optional(ATTR_FINISH_ACTIONS): vol.All(cv.ensure_list, [dict]),  # Execute on finish (required)
        vol.Optional(ATTR_REVERT, default=REVERT_OFF): vol.In(
            [REVERT_OFF, REVERT_ON_FINISH, REVERT_ON_CANCEL, REVERT_BOTH]
        ),
        vol.Optional(ATTR_REVERT_ENTITIES): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(ATTR_NOTIFY, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_HA, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_MOBILE, default=False): cv.boolean,
        vol.Optional(ATTR_NOTIFY_DEVICES): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(ATTR_AT_TIME): _validate_at_time,  # HH:MM format for absolute time
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


CANCEL_ACTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TASK_ID): cv.string,
    }
)

PAUSE_ACTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TASK_ID): cv.string,
    }
)

RESUME_ACTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TASK_ID): cv.string,
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
        # task_id -> unsubscribe callback of the pending finish timer
        self._scheduled_tasks: dict[str, Any] = {}
        # task_id -> generation token of the currently valid schedule. A fired
        # callback whose token no longer matches is stale and does nothing.
        self._tokens: dict[str, object] = {}
        # task_id -> token of a finish callback that is executing right now
        self._running: dict[str, object] = {}
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

    @callback
    def async_refresh_sensor(self) -> None:
        """Re-write the sensor state (e.g. after options changed)."""
        if self._sensor is not None:
            self._sensor.async_write_ha_state()

    @staticmethod
    def _task_context(task: dict[str, Any]) -> Context:
        """Rebuild the context of the user who scheduled the task.

        Actions executed later (finish/revert) run with the original user's
        identity so Home Assistant's permission checks (e.g. admin-only
        services) still apply instead of treating the call as a system call.
        """
        return Context(user_id=task.get("user_id"), parent_id=task.get("context_id"))

    def _schedule_finish(self, task_id: str, when: datetime) -> None:
        """Schedule the finish callback for a task with a fresh generation token."""
        old_unsub = self._scheduled_tasks.pop(task_id, None)
        if old_unsub:
            old_unsub()
        token = object()
        self._tokens[task_id] = token

        async def _fire(_now) -> None:
            await self._async_run_finish(task_id, token)

        self._scheduled_tasks[task_id] = async_track_point_in_time(self.hass, _fire, when)

    async def async_schedule_action(
        self,
        task_id: str,
        delay: int,
        unit: str,
        finish_actions: list[dict[str, Any]],
        start_actions: list[dict[str, Any]] | None = None,
        revert: str = REVERT_OFF,
        revert_entities: list[str] | None = None,
        notify: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        notify_devices: list[str] | None = None,
        at_time: str | None = None,
        time_mode: str = TIME_MODE_RELATIVE,
        task_label: str | None = None,
        context: Context | None = None,
    ) -> None:
        """Schedule a task with optional start_actions and finish_actions."""
        # Validate everything BEFORE any state is changed (start actions,
        # cancelling the previous task, snapshots).
        at_time_parts: tuple[int, int, int] | None = None
        if time_mode == TIME_MODE_ABSOLUTE:
            if not at_time:
                raise ServiceValidationError("'at_time' is required when time_mode is 'absolute'")
            try:
                at_time_parts = _parse_at_time(at_time)
            except vol.Invalid as err:
                raise ServiceValidationError(str(err)) from err

        if context is None:
            context = Context()

        # Capture an existing revert snapshot BEFORE cancelling, so that
        # re-scheduling a task that is already in a temporary (revert) state
        # preserves the ORIGINAL pre-change state instead of the temporary one.
        existing_task = self.store.get_task(task_id)
        prev_revert_scene = (existing_task or {}).get("revert_scene")
        prev_revert_actions = (existing_task or {}).get("revert_actions")

        # Cancel any existing task with this ID
        await self.async_cancel_action(task_id, silent=True)

        finish_actions = finish_actions or []
        start_actions = start_actions or []

        # If revert mode is enabled, snapshot the current state of the relevant
        # entities BEFORE running start actions, so we can restore it later.
        revert = revert or REVERT_OFF
        revert_scene: str | None = None
        revert_actions: list[dict[str, Any]] = []
        if revert != REVERT_OFF:
            if prev_revert_scene or prev_revert_actions:
                # Reuse the original snapshot (e.g. user reschedules while a
                # temporary change is still active) so we restore the true
                # original state, not the temporary one.
                revert_scene = prev_revert_scene
                revert_actions = prev_revert_actions or []
            else:
                # Targeted revert: capture only the values the start actions
                # will overwrite (reliable for climate fan_mode, temperature, …).
                revert_actions, uncovered = self._capture_revert_actions(start_actions)
                # Everything that cannot be reverted in a targeted way gets a
                # full scene snapshot (e.g. on/off services, lights that are off).
                start_entities = self._derive_revert_entities(start_actions, None)
                if revert_entities:
                    scene_entities = list(revert_entities)
                elif start_entities:
                    scene_entities = uncovered
                else:
                    scene_entities = self._derive_revert_entities(None, finish_actions)
                if scene_entities:
                    revert_scene = await self._snapshot_revert_state(
                        task_id, scene_entities, context
                    )
                if not revert_actions and not revert_scene:
                    _LOGGER.warning(
                        "Revert requested for task %s but no entities could be determined",
                        task_id,
                    )

        # Execute start actions immediately (if any). These can block for a
        # noticeable amount of time (e.g. climate commands), so the countdown
        # must be computed AFTER they complete.
        if start_actions:
            _LOGGER.info("Executing %d start actions for task %s", len(start_actions), task_id)
            for idx, action_def in enumerate(start_actions):
                try:
                    await self._execute_action_definition(action_def, context)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.error("Start action %d failed for task %s: %s", idx, task_id, err)

        # Compute the countdown now (after start actions ran) so the timer
        # reflects the full requested delay.
        now = dt_util.now()

        if at_time_parts is not None:
            hours, minutes, seconds = at_time_parts
            scheduled_time = now.replace(hour=hours, minute=minutes, second=seconds, microsecond=0)
            # Handle crossing midnight - if the time is in the past, schedule for tomorrow
            if scheduled_time <= now:
                scheduled_time = scheduled_time + timedelta(days=1)
                _LOGGER.info("Scheduled time %s is in the past, scheduling for tomorrow", at_time)
            delay_seconds = int((scheduled_time - now).total_seconds())
        else:
            delay_seconds = convert_to_seconds(delay, unit)
            scheduled_time = now + timedelta(seconds=delay_seconds)

        scheduled_time_str = now.isoformat()
        end_time_str = scheduled_time.isoformat()

        # Store the task
        await self.store.async_add_task(
            task_id=task_id,
            scheduled_time=scheduled_time_str,
            end_time=end_time_str,
            delay_seconds=delay_seconds,
            start_actions=start_actions,
            finish_actions=finish_actions,
            revert=revert,
            revert_entities=revert_entities or [],
            revert_scene=revert_scene,
            revert_actions=revert_actions,
            notify=notify,
            notify_ha=notify_ha,
            notify_mobile=notify_mobile,
            notify_devices=notify_devices or [],
            at_time=at_time,
            time_mode=time_mode,
            task_label=task_label,
            user_id=context.user_id,
            context_id=context.id,
        )

        # Schedule the finish callback
        self._schedule_finish(task_id, scheduled_time)

        # Fire event
        self.hass.bus.async_fire(
            EVENT_TASK_STARTED,
            {
                "task_id": task_id,
                "start_actions": start_actions,
                "finish_actions": finish_actions,
                "scheduled_time": scheduled_time_str,
                "end_time": end_time_str,
                "delay_seconds": delay_seconds,
            },
            context=context,
        )

        # Add history entry for the primary target entity
        primary_action = (finish_actions or start_actions or [None])[0]
        primary_entities = _target_entity_ids(primary_action) if primary_action else []
        if primary_entities:
            await self.preferences_store.async_add_to_history(
                primary_entities[0],
                {
                    "delay": delay,
                    "unit": unit,
                    "time_mode": time_mode,
                    "at_time": at_time,
                    "start_actions": start_actions,
                    "finish_actions": finish_actions,
                },
            )
            self._update_preferences_sensor()

        # Update sensor
        self._update_sensor()

        _LOGGER.info(
            "Scheduled task %s at %s (in %d seconds, time_mode=%s)",
            task_id,
            end_time_str,
            delay_seconds,
            time_mode,
        )

    async def _execute_action_definition(
        self, action_def: dict[str, Any], context: Context | None = None
    ) -> None:
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
                context=context,
                target=target or None,
            )
            _LOGGER.info("Executed %s.%s with data=%s, target=%s", domain, service_name, data, target)
        except Exception as err:
            _LOGGER.error("Failed to execute %s: %s", service, err)
            raise

    def _derive_revert_entities(
        self,
        start_actions: list[dict[str, Any]] | None,
        finish_actions: list[dict[str, Any]] | None,
    ) -> list[str]:
        """Determine which entities to snapshot for revert mode.

        Prefers entities targeted by start actions (the ones being temporarily
        changed); falls back to finish action targets.
        """
        entities: list[str] = []
        for source in (start_actions or [], finish_actions or []):
            for action_def in source:
                for cand in _target_entity_ids(action_def):
                    if cand not in entities:
                        entities.append(cand)
            if entities:
                # Use the first non-empty source only (start actions take priority)
                break
        return entities

    def _revert_scene_id(self, task_id: str) -> str:
        """Build a deterministic, slug-safe scene id for a task's revert snapshot."""
        return f"quick_timer_revert_{slugify(task_id)}"

    async def _snapshot_revert_state(
        self, task_id: str, entities: list[str], context: Context | None = None
    ) -> str | None:
        """Snapshot the current state of entities into a temporary scene.

        Returns the full scene entity_id (e.g. 'scene.quick_timer_revert_xxx')
        that can later be activated to restore the previous state.
        """
        scene_id = self._revert_scene_id(task_id)
        try:
            await self.hass.services.async_call(
                "scene",
                "create",
                {"scene_id": scene_id, "snapshot_entities": entities},
                blocking=True,
                context=context,
            )
            _LOGGER.info(
                "Snapshotted revert state for task %s (entities: %s) into scene.%s",
                task_id,
                entities,
                scene_id,
            )
            return f"scene.{scene_id}"
        except Exception as err:  # noqa: BLE001
            _LOGGER.error(
                "Failed to snapshot revert state for task %s: %s", task_id, err
            )
            return None

    async def _apply_revert(
        self, task: dict[str, Any], context: Context | None = None
    ) -> None:
        """Restore a task's snapshotted state.

        The scene snapshot (if any) restores entities that could not be
        reverted in a targeted way; targeted revert actions then restore the
        exact attributes the start actions changed (more reliable than scenes
        for e.g. climate fan modes).
        """
        if context is None:
            context = self._task_context(task)

        revert_scene = task.get("revert_scene")
        if revert_scene:
            try:
                await self.hass.services.async_call(
                    "scene",
                    "turn_on",
                    {},
                    blocking=True,
                    context=context,
                    target={"entity_id": revert_scene},
                )
                _LOGGER.info(
                    "Reverted task %s to previous state via %s",
                    task.get("task_id"),
                    revert_scene,
                )
            except Exception as err:  # noqa: BLE001
                _LOGGER.error(
                    "Failed to apply revert for task %s (%s): %s",
                    task.get("task_id"),
                    revert_scene,
                    err,
                )

        revert_actions = task.get("revert_actions") or []
        if revert_actions:
            _LOGGER.info(
                "Reverting task %s via %d targeted action(s)",
                task.get("task_id"),
                len(revert_actions),
            )
            for idx, action_def in enumerate(revert_actions):
                try:
                    await self._execute_action_definition(action_def, context)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.error(
                        "Revert action %d failed for task %s: %s",
                        idx,
                        task.get("task_id"),
                        err,
                    )

    def _capture_revert_actions(
        self, start_actions: list[dict[str, Any]] | None
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Build targeted revert actions from the current values that the
        start actions are about to overwrite.

        For each start action like ``climate.set_fan_mode`` with
        ``data={"fan_mode": "auto"}``, this reads the entity's current
        ``fan_mode`` attribute (e.g. ``"high"``) and produces an inverse action
        ``climate.set_fan_mode`` with ``data={"fan_mode": "high"}``.

        Returns ``(revert_actions, uncovered_entities)``. An entity is
        "uncovered" when at least one of its start actions cannot be inverted
        completely (no data, unknown current value, value is None such as the
        brightness of a light that is off, ...). Uncovered entities must be
        restored via a scene snapshot instead.
        """
        revert_actions: list[dict[str, Any]] = []
        uncovered: list[str] = []
        for action_def in start_actions or []:
            service = action_def.get("service")
            data = action_def.get("data") or {}
            for eid in _target_entity_ids(action_def):
                state = self.hass.states.get(eid)
                complete = bool(
                    service
                    and data
                    and state is not None
                    and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
                )
                revert_data: dict[str, Any] = {}
                if complete:
                    for key in data:
                        if key in state.attributes:
                            value = state.attributes[key]
                        elif key in _STATE_BACKED_KEYS:
                            value = state.state
                        else:
                            value = None
                        if value is None:
                            complete = False
                            break
                        revert_data[key] = value
                if complete:
                    revert_actions.append(
                        {
                            "service": service,
                            "target": {"entity_id": eid},
                            "data": revert_data,
                        }
                    )
                elif eid not in uncovered:
                    uncovered.append(eid)
        return revert_actions, uncovered

    def _format_delay(self, delay: int, unit: str) -> str:
        """Format delay for display."""
        if unit == UNIT_SECONDS:
            return f"{delay} seconds"
        elif unit == UNIT_HOURS:
            return f"{delay} hours"
        else:
            return f"{delay} minutes"

    async def _async_run_finish(self, task_id: str, token: object) -> None:
        """Execute the finish phase of a task (finish actions, revert, notify)."""
        if self._tokens.get(task_id) is not token:
            # Stale callback (task was cancelled, paused or rescheduled).
            return
        self._scheduled_tasks.pop(task_id, None)

        stored = self.store.get_task(task_id)
        if stored is None:
            self._tokens.pop(task_id, None)
            return
        # Work on a snapshot: the task may be replaced while we run.
        task = copy.deepcopy(stored)
        context = self._task_context(task)
        finish_actions = task.get("finish_actions") or []
        display_name = task.get("task_label") or task_id

        self._running[task_id] = token
        try:
            _LOGGER.info("Executing %d finish actions for task %s", len(finish_actions), task_id)
            success_count = 0
            error_count = 0
            for idx, action_def in enumerate(finish_actions):
                try:
                    await self._execute_action_definition(action_def, context)
                    success_count += 1
                except Exception as err:  # noqa: BLE001
                    _LOGGER.error("Finish action %d failed for task %s: %s", idx, task_id, err)
                    error_count += 1

            # Revert to previous state on finish (temporary mode)
            if task.get("revert", REVERT_OFF) in (REVERT_ON_FINISH, REVERT_BOTH):
                await self._apply_revert(task, context)

            self.hass.bus.async_fire(
                EVENT_TASK_COMPLETED,
                {
                    "task_id": task_id,
                    "finish_actions": finish_actions,
                    "success_count": success_count,
                    "error_count": error_count,
                },
                context=context,
            )

            notify_ha = task.get("notify_ha", False) or task.get("notify", False)
            notify_mobile = task.get("notify_mobile", False)
            notify_devices = task.get("notify_devices")
            if notify_ha or notify_mobile or notify_devices:
                if error_count > 0:
                    message = f"{success_count} actions succeeded, {error_count} failed"
                else:
                    message = f"All {success_count} actions executed successfully"
                await self._send_notification(
                    f"Timer Completed: {display_name}",
                    message,
                    notify_ha=notify_ha,
                    notify_mobile=notify_mobile,
                    notify_devices=notify_devices,
                )
        finally:
            if self._running.get(task_id) is token:
                del self._running[task_id]
            # Only clean up if the task was not rescheduled while we ran.
            if self._tokens.get(task_id) is token:
                await self._cleanup_task(task_id)

    async def _cleanup_task(self, task_id: str) -> None:
        """Clean up a completed or cancelled task."""
        unsub = self._scheduled_tasks.pop(task_id, None)
        if unsub:
            unsub()
        self._tokens.pop(task_id, None)

        # Remove from store
        await self.store.async_remove_task(task_id)

        # Update sensor
        self._update_sensor()

    async def async_shutdown(self) -> None:
        """Cancel all in-memory callbacks without removing tasks from storage.

        Used during unload / HA shutdown to stop callbacks while preserving
        stored tasks for restoration on the next setup.
        """
        for unsub in list(self._scheduled_tasks.values()):
            try:
                unsub()
            except Exception:  # noqa: BLE001
                pass
        self._scheduled_tasks.clear()
        self._tokens.clear()

        _LOGGER.info("Quick Timer shutdown: cancelled all in-memory callbacks, tasks preserved in storage")

    async def async_cancel_action(
        self,
        task_id: str,
        silent: bool = False,
        reason: str = "user_request",
        context: Context | None = None,
    ) -> bool:
        """Cancel a scheduled task."""
        if task_id in self._running:
            if not silent:
                _LOGGER.info("Task %s is already finishing, cannot cancel", task_id)
            return False

        if task_id not in self._scheduled_tasks and not self.store.has_task(task_id):
            if not silent:
                _LOGGER.debug("No scheduled task found for %s", task_id)
            return False

        # Cancel the scheduled callback
        unsub = self._scheduled_tasks.pop(task_id, None)
        if unsub:
            unsub()
        self._tokens.pop(task_id, None)

        task = self.store.get_task(task_id)
        if task is not None:
            task = copy.deepcopy(task)

        # Revert before cleanup when requested (skip when silently replacing
        # an existing task).
        if task and not silent:
            revert = task.get("revert", REVERT_OFF)
            if revert in (REVERT_ON_CANCEL, REVERT_BOTH):
                await self._apply_revert(task, context)

        # Clean up
        await self._cleanup_task(task_id)

        # Fire cancellation event
        self.hass.bus.async_fire(
            EVENT_TASK_CANCELLED,
            {
                "task_id": task_id,
                "reason": reason,
            },
            context=context,
        )

        if not silent and task and (task.get("notify_ha", False) or task.get("notify_mobile", False) or task.get("notify", False) or task.get("notify_devices")):
            display_name = task.get("task_label") or task_id
            await self._send_notification(
                f"Timer Cancelled: {display_name}",
                f"Scheduled task was cancelled ({reason})",
                notify_ha=task.get("notify_ha", False) or task.get("notify", False),
                notify_mobile=task.get("notify_mobile", False),
                notify_devices=task.get("notify_devices"),
            )

        _LOGGER.info("Cancelled scheduled task %s (reason: %s)", task_id, reason)
        return True

    async def async_pause_action(self, task_id: str) -> bool:
        """Pause a running task, freezing its remaining time."""
        task = self.store.get_task(task_id)
        if not task:
            _LOGGER.debug("No task found to pause for %s", task_id)
            return False

        if task_id in self._running:
            _LOGGER.info("Task %s is already finishing, cannot pause", task_id)
            return False

        if task.get("paused"):
            _LOGGER.debug("Task %s is already paused", task_id)
            return False

        # Cancel the pending finish callback (but keep the task in storage)
        unsub = self._scheduled_tasks.pop(task_id, None)
        if unsub:
            unsub()
        self._tokens.pop(task_id, None)

        # Compute remaining time from the stored end_time
        now = dt_util.now()
        end_time_str = task.get("end_time")
        end_time = dt_util.parse_datetime(end_time_str) if end_time_str else None
        remaining_seconds = (
            max(0, int((end_time - now).total_seconds())) if end_time else 0
        )

        await self.store.async_update_task(
            task_id,
            {"paused": True, "paused_remaining_seconds": remaining_seconds},
        )

        self.hass.bus.async_fire(
            EVENT_TASK_PAUSED,
            {"task_id": task_id, "remaining_seconds": remaining_seconds},
        )
        self._update_sensor()
        _LOGGER.info("Paused task %s (%d seconds remaining)", task_id, remaining_seconds)
        return True

    async def async_resume_action(self, task_id: str) -> bool:
        """Resume a paused task, rescheduling its finish callback."""
        task = self.store.get_task(task_id)
        if not task:
            _LOGGER.debug("No task found to resume for %s", task_id)
            return False

        if not task.get("paused"):
            _LOGGER.debug("Task %s is not paused", task_id)
            return False

        remaining_seconds = task.get("paused_remaining_seconds") or 0
        now = dt_util.now()
        new_end_time = now + timedelta(seconds=remaining_seconds)

        # Preserve a virtual start so the progress bar stays continuous:
        # virtual_start = new_end - total_duration
        delay_seconds = task.get("delay_seconds") or remaining_seconds
        virtual_start = new_end_time - timedelta(seconds=delay_seconds)

        await self.store.async_update_task(
            task_id,
            {
                "paused": False,
                "paused_remaining_seconds": None,
                "end_time": new_end_time.isoformat(),
                "scheduled_time": virtual_start.isoformat(),
            },
        )

        # Reschedule the finish callback
        self._schedule_finish(task_id, new_end_time)

        self.hass.bus.async_fire(
            EVENT_TASK_RESUMED,
            {"task_id": task_id, "remaining_seconds": remaining_seconds},
        )
        self._update_sensor()
        _LOGGER.info(
            "Resumed task %s (%d seconds remaining)", task_id, remaining_seconds
        )
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
        """Restore scheduled tasks from storage.

        Called once Home Assistant has started (so the services/entities that
        missed tasks target are available) and again after a config entry
        reload (when async_shutdown cancelled all in-memory callbacks).
        """
        now = dt_util.now()

        for task_id, task in list(self.store.get_all_tasks().items()):
            if task_id in self._scheduled_tasks or task_id in self._running:
                # Already scheduled (e.g. created after setup) — don't duplicate.
                continue

            end_time_str = task.get("end_time") or task.get("scheduled_time")
            scheduled_time = dt_util.parse_datetime(end_time_str) if end_time_str else None

            if scheduled_time is None:
                _LOGGER.warning("Invalid scheduled time for task %s, removing", task_id)
                await self.store.async_remove_task(task_id)
                continue

            # Leave paused tasks paused; they will be rescheduled on resume.
            if task.get("paused"):
                _LOGGER.info("Restoring paused task %s (frozen)", task_id)
                continue

            if scheduled_time <= now:
                _LOGGER.info(
                    "Executing missed task %s (was scheduled for %s)",
                    task_id,
                    end_time_str,
                )
                token = object()
                self._tokens[task_id] = token
                await self._async_run_finish(task_id, token)
            else:
                _LOGGER.info("Restoring scheduled task %s at %s", task_id, end_time_str)
                self._schedule_finish(task_id, scheduled_time)

        self._update_sensor()


async def _async_ensure_coordinator(hass: HomeAssistant) -> QuickTimerCoordinator:
    """Create storage + coordinator once per HA run."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    coordinator = domain_data.get("coordinator")
    if coordinator is None:
        store = QuickTimerStore(hass)
        await store.async_load()
        preferences_store = QuickTimerPreferencesStore(hass)
        await preferences_store.async_load()
        coordinator = QuickTimerCoordinator(hass, store, preferences_store)
        domain_data["coordinator"] = coordinator
        domain_data["store"] = store
        domain_data["preferences_store"] = preferences_store
    return coordinator


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Quick Timer component (storage + services).

    Tasks are NOT restored here: they are scheduled from async_setup_entry
    once Home Assistant has fully started, so that missed tasks don't run
    before the entities/services they target are available.
    """
    await _async_ensure_coordinator(hass)

    def _get_coordinator() -> QuickTimerCoordinator | None:
        coord = hass.data.get(DOMAIN, {}).get("coordinator")
        if coord is None:
            _LOGGER.error("Quick Timer coordinator not initialized")
        return coord

    async def handle_run_action(call: ServiceCall) -> None:
        """Handle the run_action service call."""
        coord = _get_coordinator()
        if coord is None:
            return

        task_id = call.data.get(ATTR_TASK_ID)
        delay = call.data.get(ATTR_DELAY, 15)
        unit = call.data.get(ATTR_UNIT, UNIT_MINUTES)
        start_actions = call.data.get(ATTR_START_ACTIONS)
        finish_actions = call.data.get(ATTR_FINISH_ACTIONS)

        if not finish_actions and not start_actions:
            raise ServiceValidationError(
                "'finish_actions' or 'start_actions' is required for quick_timer.run_action"
            )

        if not task_id:
            task_str = str(finish_actions or start_actions)
            task_id = f"task_{hashlib.md5(task_str.encode()).hexdigest()[:8]}"

        await coord.async_schedule_action(
            task_id=task_id,
            delay=delay,
            unit=unit,
            finish_actions=finish_actions,
            start_actions=start_actions,
            revert=call.data.get(ATTR_REVERT, REVERT_OFF),
            revert_entities=call.data.get(ATTR_REVERT_ENTITIES),
            notify=call.data.get(ATTR_NOTIFY, False),
            notify_ha=call.data.get(ATTR_NOTIFY_HA, False),
            notify_mobile=call.data.get(ATTR_NOTIFY_MOBILE, False),
            notify_devices=call.data.get(ATTR_NOTIFY_DEVICES, []),
            at_time=call.data.get(ATTR_AT_TIME),
            time_mode=call.data.get(ATTR_TIME_MODE, TIME_MODE_RELATIVE),
            task_label=call.data.get(ATTR_TASK_LABEL),
            context=call.context,
        )

    async def handle_cancel_action(call: ServiceCall) -> None:
        """Handle the cancel_action service call."""
        coord = _get_coordinator()
        if coord is None:
            return
        await coord.async_cancel_action(call.data[ATTR_TASK_ID], context=call.context)

    async def handle_pause_action(call: ServiceCall) -> None:
        """Handle the pause_action service call."""
        coord = _get_coordinator()
        if coord is None:
            return
        await coord.async_pause_action(call.data[ATTR_TASK_ID])

    async def handle_resume_action(call: ServiceCall) -> None:
        """Handle the resume_action service call."""
        coord = _get_coordinator()
        if coord is None:
            return
        await coord.async_resume_action(call.data[ATTR_TASK_ID])

    async def handle_get_preferences(call: ServiceCall) -> dict:
        """Handle the get_preferences service call."""
        coord = _get_coordinator()
        if coord is None:
            return {}

        entity_id = call.data.get(ATTR_ENTITY_ID)
        if entity_id:
            return coord.preferences_store.get_preferences(entity_id)
        return coord.preferences_store.get_all_preferences()

    async def handle_set_preferences(call: ServiceCall) -> None:
        """Handle the set_preferences service call."""
        coord = _get_coordinator()
        if coord is None:
            return

        entity_id = call.data[ATTR_ENTITY_ID]
        preferences = call.data[ATTR_PREFERENCES]
        _LOGGER.debug("Setting preferences for %s: %s", entity_id, preferences)
        await coord.preferences_store.async_set_preferences(entity_id, preferences)
        coord._update_preferences_sensor()

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

    if not hass.services.has_service(DOMAIN, SERVICE_PAUSE_ACTION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_PAUSE_ACTION,
            handle_pause_action,
            schema=PAUSE_ACTION_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_RESUME_ACTION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_RESUME_ACTION,
            handle_resume_action,
            schema=RESUME_ACTION_SCHEMA,
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

    # Register frontend resources and dialog injection
    await async_register_frontend(hass)

    coordinator = await _async_ensure_coordinator(hass)

    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # (Re)schedule stored tasks once HA is running. This also covers a config
    # entry reload, where async_unload_entry cancelled all callbacks.
    async def _async_restore(_hass: HomeAssistant) -> None:
        await coordinator.async_restore_tasks()

    entry.async_on_unload(async_at_started(hass, _async_restore))

    # Options (presets, dialog injection) are read live by the sensor; just
    # re-write its state so the frontend picks the change up immediately.
    async def _async_options_updated(_hass: HomeAssistant, _entry: ConfigEntry) -> None:
        coordinator.async_refresh_sensor()

    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        # Stop pending callbacks; tasks stay in storage and are restored on
        # the next setup.
        coordinator = hass.data.get(DOMAIN, {}).get("coordinator")
        if coordinator:
            await coordinator.async_shutdown()

    return unload_ok


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Remove the Lovelace resource when the integration is deleted."""
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None)
    if not resources or not hasattr(resources, "async_delete_item"):
        return
    for res in list(resources.async_items()):
        if "/quick_timer_static/" in res.get("url", ""):
            _LOGGER.info("Removing Quick Timer Card resource: %s", res["url"])
            await resources.async_delete_item(res["id"])
