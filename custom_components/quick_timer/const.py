"""Constants for Quick Timer integration."""

DOMAIN = "quick_timer"
STORAGE_KEY = "quick_timer_tasks"
STORAGE_VERSION = 4  # Bumped for task_id-based storage and action arrays

# Separate storage for user preferences (synced across devices)
PREFERENCES_STORAGE_KEY = "quick_timer_preferences"
PREFERENCES_STORAGE_VERSION = 1

# Service names
SERVICE_RUN_ACTION = "run_action"
SERVICE_CANCEL_ACTION = "cancel_action"
SERVICE_GET_PREFERENCES = "get_preferences"
SERVICE_SET_PREFERENCES = "set_preferences"

# Service fields
ATTR_TASK_ID = "task_id"  # Unique identifier for card instance
ATTR_ENTITY_ID = "entity_id"  # Legacy support
ATTR_DELAY = "delay"
ATTR_UNIT = "unit"
ATTR_NOTIFY = "notify"
ATTR_NOTIFY_HA = "notify_ha"
ATTR_NOTIFY_MOBILE = "notify_mobile"
ATTR_NOTIFY_DEVICES = "notify_devices"
ATTR_AT_TIME = "at_time"  # Absolute time (HH:MM format)
ATTR_TIME_MODE = "time_mode"  # 'relative' or 'absolute'
ATTR_PREFERENCES = "preferences"
ATTR_START_ACTIONS = "start_actions"  # List of actions to execute on start (optional)
ATTR_FINISH_ACTIONS = "finish_actions"  # List of actions to execute on finish (required)
ATTR_TASK_LABEL = "task_label"  # Human-readable label for the task (for overview)

# Legacy attributes for backward compatibility
ATTR_ACTION = "action"
ATTR_RUN_NOW = "run_now"
ATTR_SERVICE = "service"
ATTR_SERVICE_DATA = "service_data"

# Time modes
TIME_MODE_RELATIVE = "relative"
TIME_MODE_ABSOLUTE = "absolute"

# Time units
UNIT_SECONDS = "seconds"
UNIT_MINUTES = "minutes"
UNIT_HOURS = "hours"

# Sensor
SENSOR_NAME = "Quick Timer Monitor"
SENSOR_ENTITY_ID = "sensor.quick_timer_monitor"

# Events
EVENT_TASK_STARTED = "quick_timer_task_started"
EVENT_TASK_COMPLETED = "quick_timer_task_completed"
EVENT_TASK_CANCELLED = "quick_timer_task_cancelled"
