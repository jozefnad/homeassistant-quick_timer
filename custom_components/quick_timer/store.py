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

        if old_major_version == 1:
            # Migrate from v1 to v2:
            # Add new fields: end_time, delay_seconds, run_now, original_action
            migrated_data = {}
            for entity_id, task in old_data.items():
                migrated_task = dict(task)
                # Add missing fields with sensible defaults
                if "end_time" not in migrated_task:
                    migrated_task["end_time"] = migrated_task.get("scheduled_time", "")
                if "delay_seconds" not in migrated_task:
                    migrated_task["delay_seconds"] = 0
                if "run_now" not in migrated_task:
                    migrated_task["run_now"] = False
                if "original_action" not in migrated_task:
                    migrated_task["original_action"] = None
                migrated_data[entity_id] = migrated_task
            
            _LOGGER.info("Migration complete. Migrated %d tasks.", len(migrated_data))
            return migrated_data

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
        entity_id: str,
        action: str,
        scheduled_time: str,
        end_time: str,
        delay_seconds: int,
        notify: bool = False,
        run_now: bool = False,
        original_action: str | None = None,
        notify_ha: bool = False,
        notify_mobile: bool = False,
        at_time: str | None = None,
        time_mode: str = "relative",
    ) -> None:
        """Add a scheduled task."""
        self._data[entity_id] = {
            "entity_id": entity_id,
            "action": action,
            "scheduled_time": scheduled_time,
            "end_time": end_time,
            "delay_seconds": delay_seconds,
            "notify": notify,
            "notify_ha": notify_ha,
            "notify_mobile": notify_mobile,
            "run_now": run_now,
            "original_action": original_action,
            "at_time": at_time,
            "time_mode": time_mode,
        }
        await self.async_save()
        _LOGGER.info("Added scheduled task for %s: %s at %s (mode: %s)", entity_id, action, scheduled_time, time_mode)

    async def async_remove_task(self, entity_id: str) -> bool:
        """Remove a scheduled task."""
        if entity_id in self._data:
            del self._data[entity_id]
            await self.async_save()
            _LOGGER.info("Removed scheduled task for %s", entity_id)
            return True
        _LOGGER.debug("No task found for %s to remove", entity_id)
        return False

    def get_task(self, entity_id: str) -> dict[str, Any] | None:
        """Get a scheduled task."""
        return self._data.get(entity_id)

    def get_all_tasks(self) -> dict[str, dict[str, Any]]:
        """Get all scheduled tasks."""
        return self._data.copy()

    def has_task(self, entity_id: str) -> bool:
        """Check if a task exists for an entity."""
        return entity_id in self._data


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
        
        # Create a comparable key from the entry
        entry_key = f"{history_entry.get('action', '')}_{history_entry.get('time_mode', '')}_{history_entry.get('delay', '')}_{history_entry.get('unit', '')}_{history_entry.get('at_time', '')}"
        
        # Remove duplicate if exists
        history = [h for h in history if f"{h.get('action', '')}_{h.get('time_mode', '')}_{h.get('delay', '')}_{h.get('unit', '')}_{h.get('at_time', '')}" != entry_key]
        
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
