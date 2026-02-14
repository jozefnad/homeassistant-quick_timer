import logging
import os
import time
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

_LOGGER = logging.getLogger(__name__)

URL_BASE = "/quick_timer_static"
FILENAME = "quick-timer-card.js"

async def async_register_frontend(hass: HomeAssistant):
    """Register View and Lovelace resource."""
    
    # Register View
    hass.http.register_view(QuickTimerCardView())

    # Prepare URL with cache buster
    try:
        integration = await async_get_integration(hass, "quick_timer")
        version = integration.version
    except Exception:
        version = "0.0.0"  # Fallback version
        
    timestamp = int(time.time())
    url = f"{URL_BASE}/{FILENAME}?v={version}&t={timestamp}"

    # Registration or update of the resource in Lovelace
    lovelace = hass.data.get("lovelace")
    if not lovelace:
        _LOGGER.debug("Lovelace not available, skipping resource registration")
        return

    resources = getattr(lovelace, "resources", None)
    if not resources:
        _LOGGER.debug("Lovelace resources not available, skipping resource registration")
        return

    if not resources.loaded:
        await resources.async_load()
        resources.loaded = True

    installed_resource = None
    # Check existing resources
    for res in resources.async_items():
        if URL_BASE in res["url"]:
            installed_resource = res
            break

    if installed_resource:
        if installed_resource["url"] != url:
            _LOGGER.debug("Updating Quick Timer resource to: %s", url)
            await resources.async_update_item(
                installed_resource["id"], {"res_type": "module", "url": url}
            )
    else:
        _LOGGER.info("Creating new Lovelace resource for Quick Timer Card")
        if getattr(resources, "async_create_item", None):
            await resources.async_create_item({"res_type": "module", "url": url})
        elif getattr(resources, "data", None) and getattr(resources.data, "append", None):
            resources.data.append({"type": "module", "url": url})


class QuickTimerCardView(HomeAssistantView):
    """View for serving the card's JS file."""
    
    url = f"{URL_BASE}/{{filename}}"
    name = "quick_timer:card"
    requires_auth = False 

    async def get(self, request, filename):
        """Return the content of the JS file."""
        if filename != FILENAME:
            return web.Response(status=404, text="File not found")
            
        # Get the correct path
        current_dir = os.path.dirname(os.path.realpath(__file__))
        file_path = os.path.join(current_dir, "www", filename)

        # Check existence in executor (non-blocking)
        hass = request.app["hass"]
        if not await hass.async_add_executor_job(os.path.exists, file_path):
            _LOGGER.error("File does not exist at path: %s", file_path)
            return web.Response(status=404, text="File not found on disk")

        # Read file in executor (non-blocking)
        try:
            content = await hass.async_add_executor_job(self._read_file, file_path)
            return web.Response(body=content, content_type="application/javascript")
        except Exception as e:
            _LOGGER.error("Error reading file: %s", e)
            return web.Response(status=500, text=str(e))

    def _read_file(self, file_path):
        """Helper to read file safely in executor."""
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()