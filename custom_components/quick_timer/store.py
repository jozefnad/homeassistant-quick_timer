"""Storage handling for Quick Timer."""
from __future__ import annotations

import copy
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    STORAGE_KEY,
    STORAGE_VERSION,
    PREFERENCES_STORAGE_KEY,
    PREFERENCES_STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)


class QuickTimerMigratableStore(Store):
    """Store with migration support for Quick Timer."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Migrate data from old versions."""
        _LOGGER.info(
            "Migrating Quick Timer storage from version %s.%s to %s",
            old_major_version,
            old_minor_version,
            STORAGE_VERSION,
        )

        # Handle migration from any old version to v4 (task_id-based + action arrays)
        if old_major_version < 4:
            # V4 uses task_id as key instead of entity_id
            # For backward compat, we'll discard old entity-based tasks to avoid conflicts
            # Users will need to reschedule (clean slate for new architecture)
            _LOGGER.warning(
                "Storage v%s detected. Discarding old tasks due to incompatible architecture. "
                "Please reschedule your timers.", old_major_version
            )
            return {}

        # If we don't know how to migrate, return empty data
        _LOGGER.warning("Unknown storage version %s, starting fresh", old_major_version)
        return {}


class QuickTimerStore:
    """Class to manage Quick Timer task storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._store = QuickTimerMigratableStore(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> dict[str, dict[str, Any]]:
        """Load data from storage."""
        stored = await self._store.async_load()
        if stored is not None:
            self._data = stored
        else:
            self._data = {}
        _LOGGER.debug("Loaded %d scheduled tasks from storage", len(self._data))
        return self._data

    async def async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)
        _LOGGER.debug("Saved %d scheduled tasks to storage", len(self._data))

    async def async_add_task(
        self,
        task_id: str,
        scheduled_time: str,
        end_time: str,
        delay_seconds: int,
        start_actions: list[dict[str, Any]] | None = None,
        finish_actions: list[dict[str, Any]] | None = None,
        notify: bool = False,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        notify_devices: list[str] | None = None,
        at_time: str | None = None,
        time_mode: str = "relative",
        task_label: str | None = None,
    ) -> None:
        """Add a scheduled task with new architecture (task_id-based, action arrays)."""
        self._data[task_id] = {
            "task_id": task_id,
            "task_label": task_label,
            "scheduled_time": scheduled_time,
            "end_time": end_time,
            "delay_seconds": delay_seconds,
            "start_actions": start_actions or [],
            "finish_actions": finish_actions or [],
            "notify": notify,
            "notify_ha": notify_ha,
            "notify_mobile": notify_mobile,
            "notify_devices": notify_devices or [],
            "at_time": at_time,
            "time_mode": time_mode,
        }
        await self.async_save()
        _LOGGER.info("Added scheduled task %s at %s (mode: %s)", task_id, scheduled_time, time_mode)

    async def async_remove_task(self, task_id: str) -> bool:
        """Remove a scheduled task."""
        if task_id in self._data:
            del self._data[task_id]
            await self.async_save()
            _LOGGER.info("Removed scheduled task %s", task_id)
            return True
        _LOGGER.debug("No task found for %s to remove", task_id)
        return False

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """Get a scheduled task."""
        return self._data.get(task_id)

    def get_all_tasks(self) -> dict[str, dict[str, Any]]:
        """Get all scheduled tasks."""
        return self._data.copy()

    def has_task(self, task_id: str) -> bool:
        """Check if a task exists."""
        return task_id in self._data


class QuickTimerPreferencesStore:
    """Class to manage Quick Timer user preferences storage (synced across devices)."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the preferences store."""
        self.hass = hass
        self._store = Store(hass, PREFERENCES_STORAGE_VERSION, PREFERENCES_STORAGE_KEY)
        self._data: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> dict[str, dict[str, Any]]:
        """Load preferences from storage."""
        stored = await self._store.async_load()
        if stored is not None:
            self._data = stored
        else:
            self._data = {}
        _LOGGER.debug("Loaded preferences for %d entities", len(self._data))
        return self._data

    async def async_save(self) -> None:
        """Save preferences to storage."""
        await self._store.async_save(self._data)
        _LOGGER.debug("Saved preferences for %d entities", len(self._data))

    async def async_set_preferences(
        self,
        entity_id: str,
        preferences: dict[str, Any],
    ) -> None:
        """Set preferences for an entity."""
        if entity_id not in self._data:
            self._data[entity_id] = {}
        
        # Merge new preferences with existing ones
        self._data[entity_id].update(preferences)
        
        # Handle history - keep only last 3 items
        if "history" in self._data[entity_id]:
            self._data[entity_id]["history"] = self._data[entity_id]["history"][:3]
        
        await self.async_save()
        _LOGGER.debug("Updated preferences for %s", entity_id)

    async def async_add_to_history(
        self,
        entity_id: str,
        history_entry: dict[str, Any],
    ) -> None:
        """Add a history entry for an entity (keeps last 3 unique entries)."""
        if entity_id not in self._data:
            self._data[entity_id] = {}
        
        if "history" not in self._data[entity_id]:
            self._data[entity_id]["history"] = []
        
        history = self._data[entity_id]["history"]
        
        # Create a comparable key from the entry (updated for new architecture)
        entry_key = (
            f"{history_entry.get('time_mode', '')}_"
            f"{history_entry.get('delay', '')}_"
            f"{history_entry.get('unit', '')}_"
            f"{history_entry.get('at_time', '')}_"
            f"{str(history_entry.get('start_actions', []))}_"
            f"{str(history_entry.get('finish_actions', []))}"
        )
        
        # Remove duplicate if exists
        history = [
            h
            for h in history
            if (
                f"{h.get('time_mode', '')}_"
                f"{h.get('delay', '')}_"
                f"{h.get('unit', '')}_"
                f"{h.get('at_time', '')}_"
                f"{str(h.get('start_actions', []))}_"
                f"{str(h.get('finish_actions', []))}"
            )
            != entry_key
        ]
        
        # Add new entry at the beginning
        history.insert(0, history_entry)
        
        # Keep only last 3
        self._data[entity_id]["history"] = history[:3]
        
        await self.async_save()
        _LOGGER.debug("Added history entry for %s", entity_id)

    def get_preferences(self, entity_id: str) -> dict[str, Any]:
        """Get preferences for an entity."""
        # Return deep copy to prevent reference issues
        data = self._data.get(entity_id, {})
        return copy.deepcopy(data) if data else {}

    def get_all_preferences(self) -> dict[str, dict[str, Any]]:
        """Get all preferences - returns deep copy to ensure HA detects state changes."""
        return copy.deepcopy(self._data)
