# Quick Timer

[![Add to Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=quick_timer)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/jozefnad/homeassistant-quick_timer.svg)](https://github.com/jozefnad/homeassistant-quick_timer/releases)
[![License](https://img.shields.io/github/license/jozefnad/homeassistant-quick_timer.svg)](LICENSE)

If you find this integration useful, you can buy me a beer to help keep development going.

[![Buy me a beer](https://img.shields.io/badge/Donate-Buy%20me%20a%20beer-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/jozefnad)

**Quick Timer** is a custom integration for Home Assistant that allows you to schedule one-time actions (on/off/toggle) for any entity with a countdown timer.

### Installing the Lovelace Card

The Quick Timer Card is a separate component which you need to install. Install it from: [Quick Timer Card](https://github.com/jozefnad/homeassistant-quick_timer_card)

## ✨ Features

- 🕐 **One-time scheduling** - Schedule an action to execute after a specified time
- ⚡ **Run Now (Flash)** - Execute action immediately with automatic reverse action scheduling
- ⏱️ **Flexible time units** - Seconds, minutes, or hours
- 🔄 **Multiple actions** - Turn On, Turn Off, Toggle, plus domain-specific actions
- 💾 **Persistence** - Scheduled tasks survive Home Assistant restarts
- 🔔 **Notifications** - Optional HA persistent and mobile push notifications (after completion)
- 🛡️ **Auto-cancel** - Automatic cancellation of redundant tasks on manual state change
- 📊 **Monitoring sensor** - Track active scheduled tasks with countdown
- 🎨 **Lovelace integration** - Works with the separate Quick Timer Card for elegant UI
- 💉 **Dialog injection** - Automatic timer panel in more-info dialogs

## 📦 Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click on **Integrations**
3. Click the menu (⋮) in the top right corner
4. Select **Custom repositories**
5. Add URL: `https://github.com/jozefnad/homeassistant-quick_timer`
6. Category: **Integration**
7. Click **Add**
8. Search for "Quick Timer" and click **Download**
9. Restart Home Assistant

### Manual Installation

1. Download the latest release from [Releases](https://github.com/jozefnad/homeassistant-quick_timer/releases)
2. Extract and copy the `custom_components/quick_timer` folder to your `config/custom_components/`
3. Restart Home Assistant

## ⚙️ Configuration

### Adding the Integration

1. Go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for "Quick Timer"
4. Click **Submit**

### Adding the Lovelace Card

The Quick Timer Card is a separate Lovelace card. See the [Quick Timer Card repository](https://github.com/jozefnad/homeassistant-quick_timer_card) for installation and configuration instructions.

### Overview Card

Shows all active scheduled actions in one place:

```yaml
type: custom:quick-timer-overview-card
title: Active Timers
```

## 🔧 Services

### `quick_timer.run_action`

Schedule a one-time action for an entity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | ✅ | Entity ID (e.g., `light.living_room`) |
| `delay` | int | ✅ | Delay value (1-86400) |
| `unit` | string | ❌ | Unit: `seconds`, `minutes`, `hours` (default: `minutes`) |
| `action` | string | ✅ | Action: `on`, `off`, `toggle`, or domain-specific |
| `notify_ha` | bool | ❌ | Send HA persistent notification (default: `false`) |
| `notify_mobile` | bool | ❌ | Send mobile push notification (default: `false`) |
| `run_now` | bool | ❌ | Execute immediately and schedule reverse (default: `false`) |

**Example - Classic scheduling:**
```yaml
service: quick_timer.run_action
data:
  entity_id: light.living_room
  delay: 30
  unit: minutes
  action: off
  notify_ha: true
```

**Example - Run Now (flash mode):**
```yaml
service: quick_timer.run_action
data:
  entity_id: light.living_room
  delay: 5
  unit: minutes
  action: on
  run_now: true  # Turns on immediately and off in 5 minutes
```

### `quick_timer.cancel_action`

Cancel a scheduled action for an entity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | ✅ | Entity ID |

**Example:**
```yaml
service: quick_timer.cancel_action
data:
  entity_id: light.living_room
```

## 📊 Monitoring Sensor

After installation, a sensor `sensor.quick_timer_monitor` is created that provides:

- **State**: Number of active scheduled tasks
- **Attributes**:
  - `active_tasks`: Dictionary of all active tasks with details
  - `task_count`: Task count
  - `scheduled_entities`: List of entity_ids with active tasks

**Example automation:**
```yaml
trigger:
  - platform: numeric_state
    entity_id: sensor.quick_timer_monitor
    above: 0
action:
  - service: notify.mobile_app
    data:
      message: "You have {{ states('sensor.quick_timer_monitor') }} active scheduled tasks"
```

## 🔄 Auto-Cancel

The integration automatically cancels a scheduled task if you manually change the entity state:

- If **off** is scheduled and you manually **turn off** the entity → task cancelled
- If **on** is scheduled and you manually **turn on** the entity → task cancelled
- If **toggle** is scheduled and you manually **change** the state → task cancelled

This prevents redundant service calls and confusing notifications.

## 📱 Events

The integration fires the following events for use in automations:

| Event | Description |
|-------|-------------|
| `quick_timer_task_started` | Task was scheduled |
| `quick_timer_task_completed` | Task was executed |
| `quick_timer_task_cancelled` | Task was cancelled |

**Example automation:**
```yaml
trigger:
  - platform: event
    event_type: quick_timer_task_completed
action:
  - service: notify.mobile_app
    data:
      message: "Action {{ trigger.event.data.action }} for {{ trigger.event.data.entity_id }} was executed"
```

## 🐛 Troubleshooting

### Integration not showing
- Check that the folder is correctly placed in `custom_components/quick_timer/`
- Restart Home Assistant
- Check logs for errors

### Services not working
- Make sure the integration is properly configured
- Check that the entity exists and is available
- Review logs for detailed error messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request.

## ⭐ Support

If you like this project, please give it a star on GitHub!
