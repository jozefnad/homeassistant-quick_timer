"""Sensor platform for Quick Timer."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, SENSOR_NAME

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Quick Timer sensor."""
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([QuickTimerSensor(coordinator, config_entry)], True)


class QuickTimerSensor(SensorEntity):
    """Sensor to monitor Quick Timer active tasks."""

    _attr_has_entity_name = True
    _attr_name = SENSOR_NAME
    _attr_icon = "mdi:clock-outline"

    def __init__(self, coordinator, config_entry) -> None:
        """Initialize the sensor."""
        self._coordinator = coordinator
        self._config_entry = config_entry
        self._attr_unique_id = "quick_timer_monitor"
        self._active_tasks: dict[str, Any] = {}
        self._preferences: dict[str, Any] = {}

    @property
    def native_value(self) -> int:
        """Return the number of active scheduled tasks."""
        return len(self._active_tasks)

    def _parse_presets(self, preset_string: str) -> list[int]:
        """Parse comma-separated preset string into list of integers."""
        try:
            return [int(x.strip()) for x in preset_string.split(",") if x.strip()]
        except (ValueError, AttributeError):
            return []

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes with active task details."""
        now = dt_util.now()
        tasks_with_remaining = {}
        
        for task_id, task in self._active_tasks.items():
            end_time_str = task.get("end_time") or task.get("scheduled_time")
            if end_time_str:
                try:
                    end_time = dt_util.parse_datetime(end_time_str)
                    if end_time:
                        remaining_seconds = max(0, int((end_time - now).total_seconds()))
                        tasks_with_remaining[task_id] = {
                            **task,
                            "remaining_seconds": remaining_seconds,
                            "end_timestamp": end_time.timestamp(),
                        }
                    else:
                        tasks_with_remaining[task_id] = task
                except (ValueError, TypeError):
                    tasks_with_remaining[task_id] = task
            else:
                tasks_with_remaining[task_id] = task
        
        # Get presets from options
        options = self._config_entry.options
        preset_seconds = self._parse_presets(options.get("preset_seconds", "5,10,15,20,30,45"))
        preset_minutes = self._parse_presets(options.get("preset_minutes", "1,2,3,5,10,15,20,30,45"))
        preset_hours = self._parse_presets(options.get("preset_hours", "1,2,3,4,6,8,12"))
        
        return {
            "active_tasks": tasks_with_remaining,
            "task_count": len(self._active_tasks),
            "preferences": self._preferences,
            "presets": {
                "seconds": preset_seconds,
                "minutes": preset_minutes,
                "hours": preset_hours,
            },
        }

    @callback
    def update_tasks(self, tasks: dict[str, Any]) -> None:
        """Update the active tasks."""
        self._active_tasks = tasks
        self.async_write_ha_state()

    @callback
    def update_preferences(self, preferences: dict[str, Any]) -> None:
        """Update the preferences."""
        self._preferences = preferences
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        """Run when entity is added to hass."""
        await super().async_added_to_hass()
        # Register this sensor with the coordinator
        self._coordinator.register_sensor(self)
        # Initial update
        self._active_tasks = self._coordinator.get_all_tasks()
        self._preferences = self._coordinator.get_all_preferences()

    async def async_will_remove_from_hass(self) -> None:
        """Run when entity is being removed."""
        self._coordinator.unregister_sensor()
        await super().async_will_remove_from_hass()
