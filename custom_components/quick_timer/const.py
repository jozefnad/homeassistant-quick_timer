"""Constants for Quick Timer integration."""

DOMAIN = "quick_timer"
STORAGE_KEY = "quick_timer_tasks"
STORAGE_VERSION = 2

# Service names
SERVICE_RUN_ACTION = "run_action"
SERVICE_CANCEL_ACTION = "cancel_action"

# Service fields
ATTR_ENTITY_ID = "entity_id"
ATTR_DELAY = "delay"
ATTR_UNIT = "unit"
ATTR_ACTION = "action"
ATTR_NOTIFY = "notify"
ATTR_RUN_NOW = "run_now"
ATTR_NOTIFY_HA = "notify_ha"
ATTR_NOTIFY_MOBILE = "notify_mobile"

# Time units
UNIT_SECONDS = "seconds"
UNIT_MINUTES = "minutes"
UNIT_HOURS = "hours"

# Actions - basic
ACTION_ON = "on"
ACTION_OFF = "off"
ACTION_TOGGLE = "toggle"
ACTION_TURN_OFF = "turn_off"

# Actions - cover
ACTION_OPEN_COVER = "open_cover"
ACTION_CLOSE_COVER = "close_cover"
ACTION_STOP_COVER = "stop_cover"

# Actions - media_player
ACTION_MEDIA_PLAY = "media_play"
ACTION_MEDIA_STOP = "media_stop"

# Actions - vacuum
ACTION_START = "start"
ACTION_RETURN_TO_BASE = "return_to_base"

# Actions - climate
ACTION_SET_HVAC_MODE_HEAT = "set_hvac_mode_heat"
ACTION_SET_HVAC_MODE_COOL = "set_hvac_mode_cool"
ACTION_SET_HVAC_MODE_AUTO = "set_hvac_mode_auto"

# All valid actions
VALID_ACTIONS = [
    ACTION_ON, ACTION_OFF, ACTION_TOGGLE, ACTION_TURN_OFF,
    ACTION_OPEN_COVER, ACTION_CLOSE_COVER, ACTION_STOP_COVER,
    ACTION_MEDIA_PLAY, ACTION_MEDIA_STOP,
    ACTION_START, ACTION_RETURN_TO_BASE,
    ACTION_SET_HVAC_MODE_HEAT, ACTION_SET_HVAC_MODE_COOL, ACTION_SET_HVAC_MODE_AUTO,
]

# Sensor
SENSOR_NAME = "Quick Timer Monitor"
SENSOR_ENTITY_ID = "sensor.quick_timer_monitor"

# Events
EVENT_TASK_STARTED = "quick_timer_task_started"
EVENT_TASK_COMPLETED = "quick_timer_task_completed"
EVENT_TASK_CANCELLED = "quick_timer_task_cancelled"
