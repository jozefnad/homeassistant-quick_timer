"""Config flow for Quick Timer integration."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
import homeassistant.helpers.config_validation as cv

from .const import DOMAIN


class QuickTimerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Quick Timer."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ):
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Quick Timer",
                data={},
            )

        return self.async_show_form(step_id="user")

    @staticmethod
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return QuickTimerOptionsFlow()


class QuickTimerOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for Quick Timer."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ):
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "preset_seconds",
                        default=self.config_entry.options.get(
                            "preset_seconds", "5,10,15,20,30,45"
                        ),
                    ): cv.string,
                    vol.Optional(
                        "preset_minutes",
                        default=self.config_entry.options.get(
                            "preset_minutes", "1,2,3,5,10,15,20,30,45"
                        ),
                    ): cv.string,
                    vol.Optional(
                        "preset_hours",
                        default=self.config_entry.options.get(
                            "preset_hours", "1,2,3,4,6,8,12"
                        ),
                    ): cv.string,
                }
            ),
        )
