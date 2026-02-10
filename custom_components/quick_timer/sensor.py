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
    async_add_entities([QuickTimerSensor(coordinator)], True)


class QuickTimerSensor(SensorEntity):
    """Sensor to monitor Quick Timer active tasks."""

    _attr_has_entity_name = True
    _attr_name = SENSOR_NAME
    _attr_icon = "mdi:clock-outline"

    def __init__(self, coordinator) -> None:
        """Initialize the sensor."""
        self._coordinator = coordinator
        self._attr_unique_id = "quick_timer_monitor"
        self._active_tasks: dict[str, Any] = {}

    @property
    def native_value(self) -> int:
        """Return the number of active scheduled tasks."""
        return len(self._active_tasks)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes with active task details."""
        now = dt_util.now()
        tasks_with_remaining = {}
        
        for entity_id, task in self._active_tasks.items():
            end_time_str = task.get("end_time") or task.get("scheduled_time")
            if end_time_str:
                try:
                    end_time = dt_util.parse_datetime(end_time_str)
                    if end_time:
                        remaining_seconds = max(0, int((end_time - now).total_seconds()))
                        tasks_with_remaining[entity_id] = {
                            **task,
                            "remaining_seconds": remaining_seconds,
                            "end_timestamp": end_time.timestamp(),
                        }
                    else:
                        tasks_with_remaining[entity_id] = task
                except (ValueError, TypeError):
                    tasks_with_remaining[entity_id] = task
            else:
                tasks_with_remaining[entity_id] = task
        
        return {
            "active_tasks": tasks_with_remaining,
            "task_count": len(self._active_tasks),
            "scheduled_entities": list(self._active_tasks.keys()),
        }

    @callback
    def update_tasks(self, tasks: dict[str, Any]) -> None:
        """Update the active tasks."""
        self._active_tasks = tasks
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        """Run when entity is added to hass."""
        await super().async_added_to_hass()
        # Register this sensor with the coordinator
        self._coordinator.register_sensor(self)
        # Initial update
        self._active_tasks = self._coordinator.get_all_tasks()

    async def async_will_remove_from_hass(self) -> None:
        """Run when entity is being removed."""
        self._coordinator.unregister_sensor()
        await super().async_will_remove_from_hass()
