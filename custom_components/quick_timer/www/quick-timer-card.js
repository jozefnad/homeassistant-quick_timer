/**
 * Quick Timer Card
 * A professional Lovelace card for scheduling one-time actions on Home Assistant entities.
 * 
 * Architecture: Multi-target with start_actions + finish_actions arrays,
 * unique card IDs for task isolation, dynamic presets from sensor.
 *
 * Features: Advanced interactions, dynamic visuals, intelligent content, modular editor,
 *           absolute time support, backend-synced persistence, history presets,
 *           dialog injection with full Quick Timer panel.
 *
 * @author Quick Timer
 */

// ============================================
// LitElement Base
// ============================================

const LitElement = customElements.get('hui-masonry-view')
  ? Object.getPrototypeOf(customElements.get('hui-masonry-view'))
  : Object.getPrototypeOf(customElements.get('hui-view'));

const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

// ============================================
// Constants
// ============================================

const CARD_VERSION = '';
const TIME_MODE_RELATIVE = 'relative';
const TIME_MODE_ABSOLUTE = 'absolute';
const MONITOR_ENTITY = 'sensor.quick_timer_monitor';

const DEFAULT_CONFIG = {
  card_id: '',
  targets: [],
  name: '',
  icon: '',
  color: 'state',
  default_delay: 15,
  default_unit: 'minutes',
  default_time_mode: TIME_MODE_RELATIVE,
  default_at_time: '',
  mode: 'compact',
  show_badge: true,
  show_progress_bar: false,
  inactive_style: 'dim',
  primary_info: 'name',
  secondary_info: 'timer',
  tap_action: { action: 'toggle-timer' },
  hold_action: { action: 'settings' },
  icon_tap_action: { action: 'settings' },
  notify_ha: false,
  notify_devices: [],
};

// Maps a named HA color to its CSS variable. Returns null for the 'state' pseudo-color.
function namedColorToCss(colorName) {
  if (!colorName || colorName === 'state') return null;
  return `var(--${colorName}-color)`;
}

const ACTION_TYPES = {
  'toggle-timer': 'Start/Cancel Timer',
  'settings': 'Open Settings',
  'none': 'No Action',
};

const PRIMARY_INFO_OPTIONS = {
  name: 'Name', state: 'Entity State', 'last-changed': 'Last Changed', none: 'Hidden',
};

const SECONDARY_INFO_OPTIONS = {
  timer: 'Timer/Countdown', state: 'Entity State', action: 'Scheduled Action', none: 'Hidden',
};

// ============================================
// Internationalization (i18n)
// ============================================

const TRANSLATIONS = {
  en: {
    // Common
    'schedule': 'Schedule', 'cancel': 'Cancel', 'delay': 'Delay', 'time': 'Time',
    'quick_timer': 'Quick Timer', 'recent': 'Recent', 'history': 'History',
    'action': 'Action',
    // Units
    'seconds': 'Seconds', 'minutes': 'Minutes', 'hours': 'Hours',
    'sec': 'sec', 'min': 'min', 'hrs': 'hrs',
    // Time
    'ago_format': '{v}{u} ago', 'd': 'd', 'h': 'h', 'm': 'm', 's': 's',
    // States
    'on': 'On', 'off': 'Off',
    // Card
    'countdown_to_action': 'Countdown to action',
    'no_active_timers': 'No active timers',
    'add_at_least_one_target': 'Please add at least one target',
    'n_targets_configured': '{n} targets configured',
    'one_entity_scheduled': '1 Entity Scheduled',
    'n_entities_scheduled': '{n} Entities Scheduled',
    'n_actions': '{n} actions',
    'timer': 'Timer', 'in': 'in', 'at': 'at',
    // Notifications
    'ha_notification': 'HA Notification', 'mobile_notification': 'Mobile Notification',
    'mobile_notification_devices': 'Mobile Notification Devices',
    // Editor sections
    'targets_and_timer': 'Targets & Timer', 'appearance': 'Appearance', 'interactions': 'Interactions',
    // Editor fields
    'name_optional': 'Name (optional)', 'auto_from_targets': 'Auto from targets',
    'time_mode': 'Time Mode', 'delay_relative': 'Delay (Relative)', 'time_absolute': 'Time (Absolute)',
    'time_unit': 'Time Unit', 'default_delay': 'Default Delay', 'default_time_hhmm': 'Default Time (HH:MM)',
    'targets_and_actions': 'Targets and actions',
    'targets_hint_1': 'Add entity targets that will be scheduled together. Each target can execute',
    'targets_hint_bold_1': 'on timer start',
    'targets_hint_2': '(immediately) or',
    'targets_hint_bold_2': 'on timer finish',
    'targets_hint_3': '(when countdown ends).',
    'add_target': 'Add Target',
    'on_start': 'On Start', 'on_finish': 'On Finish',
    'exec_on_finish': 'Execute on Finish (when timer ends)',
    'exec_on_start': 'Execute on Start (immediately)',
    // Display
    'display_mode': 'Display Mode', 'compact_tile': 'Compact (Tile)', 'full': 'Full',
    'show_progress_bar': 'Show Progress Bar', 'show_badge': 'Show Badge',
    'icon': 'Icon', 'icon_color': 'Icon Color',
    'primary_info': 'Primary Info', 'secondary_info': 'Secondary Info',
    'inactive_style': 'Inactive Style',
    'inactive_none': 'None', 'inactive_dim': 'Dim (opacity)', 'inactive_grayscale': 'Grayscale',
    'hide_when_empty': 'Hide when empty',
    // Interactions
    'tap': 'Tap', 'hold': 'Hold', 'icon_tap': 'Icon Tap',
    // Action types
    'action_toggle_timer': 'Start/Cancel Timer', 'action_settings': 'Open Settings', 'action_none': 'No Action',
    // Primary info options
    'pi_name': 'Name', 'pi_state': 'Entity State', 'pi_last_changed': 'Last Changed', 'pi_none': 'Hidden',
    // Secondary info options
    'si_timer': 'Timer/Countdown', 'si_state': 'Entity State', 'si_action': 'Scheduled Action', 'si_none': 'Hidden',
    // Overview
    'quick_timers': 'Quick Timers',
    // Phase
    'start': 'start', 'finish': 'finish',
    // Color
    'color_auto': 'Auto color (by timer state)',
    'card_title': 'Card Title',
  },
  sk: {
    // Common
    'schedule': 'Naplánovať', 'cancel': 'Zrušiť', 'delay': 'Oneskorenie', 'time': 'Čas',
    'quick_timer': 'Quick Timer', 'recent': 'Nedávne', 'history': 'História',
    'action': 'Akcia',
    // Units
    'seconds': 'Sekundy', 'minutes': 'Minúty', 'hours': 'Hodiny',
    'sec': 'sek', 'min': 'min', 'hrs': 'hod',
    // Time
    'ago_format': 'pred {v}{u}', 'd': 'd', 'h': 'h', 'm': 'm', 's': 's',
    // States
    'on': 'Zapnuté', 'off': 'Vypnuté',
    // Card
    'countdown_to_action': 'Odpočet do akcie',
    'no_active_timers': 'Žiadne aktívne časovače',
    'add_at_least_one_target': 'Pridajte aspoň jeden cieľ',
    'n_targets_configured': '{n} cieľov nakonfigurovaných',
    'one_entity_scheduled': '1 entita naplánovaná',
    'n_entities_scheduled': '{n} entít naplánovaných',
    'n_actions': '{n} akcií',
    'timer': 'Časovač', 'in': 'za', 'at': 'o',
    // Notifications
    'ha_notification': 'HA upozornenie', 'mobile_notification': 'Mobilné upozornenie',
    'mobile_notification_devices': 'Zariadenia mobilných upozornení',
    // Editor sections
    'targets_and_timer': 'Ciele a časovač', 'appearance': 'Vzhľad', 'interactions': 'Interakcie',
    // Editor fields
    'name_optional': 'Názov (voliteľný)', 'auto_from_targets': 'Auto z cieľov',
    'time_mode': 'Časový režim', 'delay_relative': 'Oneskorenie (Relatívne)', 'time_absolute': 'Čas (Absolútny)',
    'time_unit': 'Časová jednotka', 'default_delay': 'Predvolené oneskorenie', 'default_time_hhmm': 'Predvolený čas (HH:MM)',
    'targets_and_actions': 'Ciele a akcie',
    'targets_hint_1': 'Pridajte ciele entít, ktoré budú naplánované spoločne. Každý cieľ sa môže vykonať',
    'targets_hint_bold_1': 'pri štarte časovača',
    'targets_hint_2': '(okamžite) alebo',
    'targets_hint_bold_2': 'pri skončení časovača',
    'targets_hint_3': '(keď odpočet skončí).',
    'add_target': 'Pridať cieľ',
    'on_start': 'Na štarte', 'on_finish': 'Na konci',
    'exec_on_finish': 'Vykonať na konci (keď časovač skončí)',
    'exec_on_start': 'Vykonať na štarte (okamžite)',
    // Display
    'display_mode': 'Režim zobrazenia', 'compact_tile': 'Kompaktný (Dlaždica)', 'full': 'Plný',
    'show_progress_bar': 'Zobraziť priebeh', 'show_badge': 'Zobraziť odznak',
    'icon': 'Ikona', 'icon_color': 'Farba ikony',
    'primary_info': 'Primárna info', 'secondary_info': 'Sekundárna info',
    'inactive_style': 'Neaktívny štýl',
    'inactive_none': 'Žiadny', 'inactive_dim': 'Stlmený (priehľadnosť)', 'inactive_grayscale': 'Odtiene sivej',
    'hide_when_empty': 'Skryť keď prázdne',
    // Interactions
    'tap': 'Ťuknutie', 'hold': 'Podržanie', 'icon_tap': 'Ťuknutie na ikonu',
    // Action types
    'action_toggle_timer': 'Štart/Zrušiť časovač', 'action_settings': 'Otvoriť nastavenia', 'action_none': 'Žiadna akcia',
    // Primary info options
    'pi_name': 'Názov', 'pi_state': 'Stav entity', 'pi_last_changed': 'Naposledy zmenené', 'pi_none': 'Skrytý',
    // Secondary info options
    'si_timer': 'Časovač/Odpočet', 'si_state': 'Stav entity', 'si_action': 'Naplánovaná akcia', 'si_none': 'Skrytý',
    // Overview
    'quick_timers': 'Quick Timers',
    // Phase
    'start': 'štart', 'finish': 'koniec',
    // Color
    'color_auto': 'Automatická farba (podľa stavu)',
    'card_title': 'Názov karty',
  },
};

let _qtLang = 'en';

function updateLanguage(hass) {
  if (hass?.language) {
    _qtLang = TRANSLATIONS[hass.language] ? hass.language : 'en';
  }
}

function t(key) {
  return TRANSLATIONS[_qtLang]?.[key] || TRANSLATIONS['en']?.[key] || key;
}

// ============================================
// Helpers
// ============================================

function generateCardId() {
  return `qt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

function getPresetsFromSensor(hass) {
  const presets = hass?.states?.[MONITOR_ENTITY]?.attributes?.presets;
  if (presets?.seconds && presets?.minutes && presets?.hours) return presets;
  return { seconds: [5, 10, 15, 20, 30, 45], minutes: [1, 2, 3, 5, 10, 15, 20, 30, 45], hours: [1, 2, 3, 4, 6, 8, 12] };
}

function getServiceLabel(hass, service) {
  if (!service) return '';
  if (hass && service.includes('.')) {
    const [d, s] = service.split('.', 2);
    // Try HA's frontend localization first (always returns the properly translated name)
    if (typeof hass.localize === 'function') {
      const localized = hass.localize(`component.${d}.services.${s}.name`);
      if (localized) return localized;
    }
    // Fall back to service registry name (may be pre-translated in newer HA)
    const info = hass.services?.[d]?.[s];
    if (info?.name) return info.name;
  }
  const name = service.includes('.') ? service.split('.')[1] : service;
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function localizeState(hass, entityId, state) {
  if (!hass || !state) return state;
  // Use HA's built-in state formatting (HA 2023.9+)
  if (typeof hass.formatEntityState === 'function' && entityId) {
    const stateObj = hass.states?.[entityId];
    if (stateObj) { try { return hass.formatEntityState(stateObj); } catch (e) { /* fallback */ } }
  }
  // Fallback: try hass.localize with known key patterns
  if (typeof hass.localize === 'function') {
    const domain = entityId ? entityId.split('.')[0] : '';
    if (domain) {
      const loc = hass.localize(`component.${domain}.entity_component._.state.${state}`);
      if (loc) return loc;
    }
    const def = hass.localize(`component._.entity_component._.state.${state}`);
    if (def) return def;
  }
  return state;
}

function localizeFieldName(hass, domain, service, fieldKey, fallback) {
  if (hass && typeof hass.localize === 'function') {
    const loc = hass.localize(`component.${domain}.services.${service}.fields.${fieldKey}.name`);
    if (loc) return loc;
  }
  return fallback || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getServiceFields(hass, service, entityId) {
  if (!hass || !service || !service.includes('.')) return {};
  const [d, s] = service.split('.', 2);
  const svcDef = hass.services?.[d]?.[s];
  if (!svcDef) return {};

  const entityState = entityId ? hass.states?.[entityId] : null;
  const supportedFeatures = Number(entityState?.attributes?.supported_features) || 0;

  const allFields = {};
  const filtered = {};
  let anyFiltered = false;

  const processFields = (fields) => {
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'entity_id') continue;
      // If this is a section (has nested fields), flatten it
      if (v.fields) { processFields(v.fields); continue; }
      allFields[k] = v;
      // Apply HA's native field filter
      if (entityId && v.filter) {
        let passesFilter = true;
        if (v.filter.supported_features) {
          let featureList = v.filter.supported_features;
          if (!Array.isArray(featureList)) featureList = [featureList];
          const matches = featureList.some(feature => {
            if (Array.isArray(feature)) return feature.every(f => supportedFeatures & f);
            return supportedFeatures & feature;
          });
          if (!matches) passesFilter = false;
        }
        if (passesFilter && v.filter.attribute && entityState) {
          for (const [attrName, attrValues] of Object.entries(v.filter.attribute)) {
            if (!attrName || !Array.isArray(attrValues)) continue;
            const entityAttrVal = entityState.attributes?.[attrName];
            if (Array.isArray(entityAttrVal)) { if (!attrValues.some(val => entityAttrVal.includes(val))) passesFilter = false; }
            else { if (!attrValues.includes(entityAttrVal)) passesFilter = false; }
          }
        }
        anyFiltered = true;
        if (!passesFilter) continue;
      }
      filtered[k] = v;
    }
  };

  processFields(svcDef.fields || {});

  // Localize field names and descriptions
  const localizeFields = (fields) => {
    const result = {};
    for (const [key, field] of Object.entries(fields)) {
      const locField = { ...field };
      if (typeof hass.localize === 'function') {
        const lName = hass.localize(`component.${d}.services.${s}.fields.${key}.name`);
        if (lName) locField.name = lName;
        const lDesc = hass.localize(`component.${d}.services.${s}.fields.${key}.description`);
        if (lDesc) locField.description = lDesc;
      }
      result[key] = locField;
    }
    return result;
  };

  // If filtering removed ALL fields but there were unfiltered fields, return all
  // (the entity might not report supported_features correctly)
  if (anyFiltered && Object.keys(filtered).length === 0 && Object.keys(allFields).length > 0) {
    return localizeFields(allFields);
  }
  return localizeFields(filtered);
}

function getServicesForEntity(hass, entityId) {
  if (!hass || !entityId) return [];
  const domain = entityId.split('.')[0];
  const svc = hass.services?.[domain];
  if (!svc) return [];
  return Object.entries(svc).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
    let label = '';
    // Try HA's frontend localization first
    if (typeof hass.localize === 'function') {
      label = hass.localize(`component.${domain}.services.${k}.name`);
    }
    if (!label) label = v.name || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { value: `${domain}.${k}`, label, fields: v.fields || {} };
  });
}

function getDefaultServiceForEntity(hass, entityId) {
  if (!entityId) return '';
  const d = entityId.split('.')[0];
  const defaults = { light: 'turn_off', switch: 'turn_off', input_boolean: 'turn_off', fan: 'turn_off', cover: 'close_cover', media_player: 'turn_off', vacuum: 'return_to_base', climate: 'turn_off', humidifier: 'turn_off', automation: 'turn_off', script: 'turn_on' };
  if (defaults[d]) return `${d}.${defaults[d]}`;
  if (hass?.services?.[d]?.turn_off) return `${d}.turn_off`;
  if (hass?.services?.[d]?.turn_on) return `${d}.turn_on`;
  const svcs = getServicesForEntity(hass, entityId);
  return svcs[0]?.value || '';
}

function formatCountdown(s) {
  if (s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatCountdownShort(s) {
  if (s <= 0) return '0s';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatBadgeTime(s) {
  if (s <= 0) return '0';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function getUnitLabel(u, short = false) {
  return short ? ({ seconds: t('sec'), minutes: t('min'), hours: t('hrs') }[u] || t('min')) : ({ seconds: t('seconds'), minutes: t('minutes'), hours: t('hours') }[u] || t('minutes'));
}

function getRelativeTime(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  let v, u;
  if (diff >= 86400) { v = Math.floor(diff / 86400); u = t('d'); }
  else if (diff >= 3600) { v = Math.floor(diff / 3600); u = t('h'); }
  else if (diff >= 60) { v = Math.floor(diff / 60); u = t('m'); }
  else { v = Math.floor(diff); u = t('s'); }
  return t('ago_format').replace('{v}', v).replace('{u}', u);
}

function getCurrentTimeString() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

function getDefaultAbsoluteTime() {
  const n = new Date(); n.setMinutes(n.getMinutes() + 30);
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

/**
 * Build action arrays from config targets.
 * Each target has: { entity, service, data, phase }
 *   phase: 'finish' (default) or 'start'
 */
function buildActionArrays(targets) {
  const start = [], finish = [];
  for (const t of targets) {
    if (!t.entity || !t.service) continue;
    const def = { service: t.service, target: { entity_id: t.entity }, data: t.data || {} };
    if (t.phase === 'start') start.push(def);
    else finish.push(def);
  }
  return { start_actions: start, finish_actions: finish };
}

/**
 * Summarize targets for display.
 */
function summarizeActions(hass, targets) {
  if (!targets || targets.length === 0) return '';
  if (targets.length === 1) {
    return getServiceLabel(hass, targets[0].service);
  }
  return t('n_actions').replace('{n}', targets.length);
}

/**
 * Format service data values for display (e.g., "temperature: 22, brightness: 128").
 */
function formatServiceData(data, hass, service) {
  if (!data || typeof data !== 'object') return '';
  const entries = Object.entries(data).filter(([k, v]) => k !== 'entity_id' && v !== '' && v !== null && v !== undefined);
  if (entries.length === 0) return '';
  const [domain, svcName] = (service || '').includes('.') ? service.split('.', 2) : ['', ''];
  return entries.map(([k, v]) => {
    const label = (domain && svcName) ? localizeFieldName(hass, domain, svcName, k, k.replace(/_/g, ' ')) : k.replace(/_/g, ' ');
    return `${label}: ${v}`;
  }).join(', ');
}

// ============================================
// Preferences Manager
// ============================================

class PreferencesManager {
  constructor() { this._cache = {}; }

  getFromSensor(hass, entityId) {
    if (!hass || !entityId) return {};
    const prefs = hass.states[MONITOR_ENTITY]?.attributes?.preferences?.[entityId];
    if (prefs) this._cache[entityId] = prefs;
    return this._cache[entityId] || {};
  }

  async savePreferences(hass, entityId, preferences) {
    if (!hass || !entityId) return;
    this._cache[entityId] = { ...this._cache[entityId], ...preferences };
    try {
      await hass.callService('quick_timer', 'set_preferences', { entity_id: entityId, preferences });
    } catch (e) { console.error('[Quick Timer] Failed to save preferences:', e); }
  }

  getFromCache(entityId) { return this._cache[entityId] || {}; }

  updateCacheFromSensor(hass) {
    if (!hass) return;
    const p = hass.states[MONITOR_ENTITY]?.attributes?.preferences;
    if (p) this._cache = { ...this._cache, ...p };
  }
}

const preferencesManager = new PreferencesManager();

// ============================================
// Quick Timer Card Editor
// ============================================

class QuickTimerCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _expandedSections: { type: Object },
    };
  }

  constructor() {
    super();
    this._expandedSections = { targets: true, appearance: false, interactions: false };
  }

  static get styles() {
    return css`
      .editor-container { padding: 8px 0; }
      .section { margin-bottom: 8px; border: 1px solid var(--divider-color); border-radius: 8px; overflow: hidden; }
      .section-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--secondary-background-color); cursor: pointer; user-select: none; transition: background 0.2s; }
      .section-header:hover { background: var(--divider-color); }
      .section-header ha-icon { --mdc-icon-size: 20px; color: var(--primary-color); }
      .section-header .title { flex: 1; font-weight: 500; font-size: 14px; color: var(--primary-text-color); }
      .section-header .chevron { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.2s; }
      .section-header .chevron.expanded { transform: rotate(180deg); }
      .section-content { padding: 16px; display: none; }
      .section-content.expanded { display: block; }
      .editor-row { margin-bottom: 16px; }
      .editor-row:last-child { margin-bottom: 0; }
      .editor-row label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; }
      ha-selector, ha-select, ha-textfield { width: 100%; display: block; }
      .inline-row { display: flex; gap: 12px; flex-wrap: wrap; }
      .inline-row > * { flex: 1; min-width: 120px; }
      @media (max-width: 400px) { .inline-row { flex-direction: column; } .inline-row > * { min-width: 100%; } }
      .switch-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; }
      .switch-row label { margin-bottom: 0; flex: 1; }

      .action-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--divider-color); flex-wrap: wrap; }
      .action-row:last-child { border-bottom: none; }
      .action-row .action-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
      .action-row .action-label { flex: 1; font-size: 13px; color: var(--primary-text-color); min-width: 80px; }
      .action-row ha-select { width: 180px; flex-shrink: 0; }
      .target-card { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; margin-bottom: 8px; background: var(--secondary-background-color); }
      .target-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .target-header .target-num { font-size: 11px; font-weight: 600; color: var(--primary-color); background: rgba(var(--rgb-primary-color), 0.1); padding: 2px 8px; border-radius: 4px; }
      .target-header .target-phase { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
      .target-header .target-phase.finish { background: rgba(var(--rgb-primary-color), 0.1); color: var(--primary-color); }
      .target-header .target-phase.start { background: rgba(76, 175, 80, 0.15); color: var(--success-color, #4caf50); }
      .target-header .target-remove { --mdc-icon-size: 18px; color: var(--error-color, #db4437); cursor: pointer; margin-left: auto; }
      .target-header .target-remove:hover { opacity: 0.7; }
      .add-target-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; border: 2px dashed var(--divider-color); border-radius: 8px; background: transparent; color: var(--primary-color); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .add-target-btn:hover { border-color: var(--primary-color); background: rgba(var(--rgb-primary-color), 0.05); }
      .hint { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 12px; line-height: 1.4; }
    `;
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    // Ensure card_id exists
    if (!this._config.card_id) {
      this._config.card_id = generateCardId();
      this._fireConfigChanged();
    }
  }

  _fireConfigChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _valueChanged(key, value) {
    if (!this._config || !this.hass) return;
    this._config = { ...this._config, [key]: value };
    this._fireConfigChanged();
  }

  _actionChanged(key, value) {
    if (!this._config || !this.hass) return;
    this._config = { ...this._config, [key]: { action: value } };
    this._fireConfigChanged();
  }

  _addTarget(phase = 'finish') {
    const targets = [...(this._config.targets || []), { entity: '', service: '', data: {}, phase }];
    this._valueChanged('targets', targets);
  }

  _removeTarget(idx) {
    const targets = [...(this._config.targets || [])];
    targets.splice(idx, 1);
    this._valueChanged('targets', targets);
  }

  _targetChanged(idx, field, value) {
    const targets = [...(this._config.targets || [])];
    // If nothing changed, do nothing (prevents resetting data when re-selecting same entity/service)
    if (targets[idx][field] === value) {
      return;
    }

    targets[idx] = { ...targets[idx], [field]: value };
    if (field === 'entity' && value && !targets[idx].service) {
      targets[idx].service = getDefaultServiceForEntity(this.hass, value);
      targets[idx].data = {};  // reset data when entity changes
    }
    if (field === 'service') {
      targets[idx].data = {};  // reset data when service changes
    }
    this._valueChanged('targets', targets);
  }

  _targetDataChanged(idx, key, value) {
    const targets = [...(this._config.targets || [])];
    const data = { ...(targets[idx].data || {}) };
    // Preserve correct types: if value is empty/null/undefined/NaN, remove the key
    if (value === '' || value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
      delete data[key];
    } else {
      data[key] = value;
    }
    targets[idx] = { ...targets[idx], data };
    this._valueChanged('targets', targets);
  }

  _toggleSection(section) {
    this._expandedSections = { ...this._expandedSections, [section]: !this._expandedSections[section] };
    this.requestUpdate();
  }

  _renderSection(id, icon, title, content) {
    const expanded = this._expandedSections[id];
    return html`
      <div class="section">
        <div class="section-header" @click=${() => this._toggleSection(id)}>
          <ha-icon icon="${icon}"></ha-icon>
          <span class="title">${title}</span>
          <ha-icon class="chevron ${expanded ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="section-content ${expanded ? 'expanded' : ''}">${content}</div>
      </div>
    `;
  }

  _renderTargetsSection() {
    const targets = this._config.targets || [];
    const entitySelector = { entity: {} };

    const renderTarget = (target, globalIdx) => {
      const targetServices = target.entity ? getServicesForEntity(this.hass, target.entity) : [];
      const targetFields = target.service ? getServiceFields(this.hass, target.service, target.entity) : {};
      const isStart = target.phase === 'start';
      return html`
        <div class="target-card">
          <div class="target-header">
            <span class="target-num">#${globalIdx + 1}</span>
            <span class="target-phase ${isStart ? 'start' : 'finish'}">${isStart ? t('on_start') : t('on_finish')}</span>
            <ha-icon class="target-remove" icon="mdi:delete" @click=${() => this._removeTarget(globalIdx)}></ha-icon>
          </div>
          <div style="margin-bottom: 8px;">
            <ha-selector .hass=${this.hass} .selector=${entitySelector} .value=${target.entity || ''} @value-changed=${(e) => this._targetChanged(globalIdx, 'entity', e.detail.value)}></ha-selector>
          </div>
          ${target.entity ? html`
            <div style="margin-bottom: 8px;">
              <ha-select .value=${target.service || ''} @selected=${(e) => this._targetChanged(globalIdx, 'service', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition style="width: 100%;">
                ${targetServices.map(s => html`<ha-list-item value="${s.value}">${s.label}</ha-list-item>`)}
              </ha-select>
            </div>
            ${Object.keys(targetFields).length > 0 ? html`
              ${Object.entries(targetFields).map(([key, field]) => html`
                <div style="margin-bottom: 6px;">
                  ${field.selector ? html`
                    <ha-selector .hass=${this.hass} .selector=${field.selector} .value=${(target.data || {})[key]} .label=${field.name || key} .required=${field.required === true}
                      @value-changed=${(e) => this._targetDataChanged(globalIdx, key, e.detail.value)}></ha-selector>
                  ` : html`
                    <ha-textfield .value=${String((target.data || {})[key] ?? '')} .required=${field.required === true}
                      @change=${(e) => {
                        const raw = e.target.value;
                        const num = Number(raw);
                        this._targetDataChanged(globalIdx, key, raw !== '' && !isNaN(num) ? num : raw);
                      }} .label=${field.name || key}></ha-textfield>
                  `}
                </div>
              `)}
            ` : ''}
            <div style="margin-top: 6px;">
              <ha-select .value=${target.phase || 'finish'} @selected=${(e) => this._targetChanged(globalIdx, 'phase', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition style="width: 100%;">
                <ha-list-item value="finish">${t('exec_on_finish')}</ha-list-item>
                <ha-list-item value="start">${t('exec_on_start')}</ha-list-item>
              </ha-select>
            </div>
          ` : ''}
        </div>
      `;
    };

    return html`
      <!-- Timer Defaults -->
      <div class="editor-row">
        <label>${t('name_optional')}</label>
        <ha-textfield .value=${this._config.name || ''} @input=${(e) => this._valueChanged('name', e.target.value)} placeholder="${t('auto_from_targets')}"></ha-textfield>
      </div>
      <div class="inline-row">
        <div class="editor-row">
          <label>${t('time_mode')}</label>
          <ha-select .value=${this._config.default_time_mode || TIME_MODE_RELATIVE} @selected=${(e) => this._valueChanged('default_time_mode', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            <ha-list-item value="relative">${t('delay_relative')}</ha-list-item>
            <ha-list-item value="absolute">${t('time_absolute')}</ha-list-item>
          </ha-select>
        </div>
        ${(this._config.default_time_mode || TIME_MODE_RELATIVE) === TIME_MODE_RELATIVE ? html`
          <div class="editor-row">
            <label>${t('time_unit')}</label>
            <ha-select .value=${this._config.default_unit || 'minutes'} @selected=${(e) => this._valueChanged('default_unit', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
              <ha-list-item value="seconds">${t('seconds')}</ha-list-item>
              <ha-list-item value="minutes">${t('minutes')}</ha-list-item>
              <ha-list-item value="hours">${t('hours')}</ha-list-item>
            </ha-select>
          </div>
        ` : ''}
      </div>
      ${(this._config.default_time_mode || TIME_MODE_RELATIVE) === TIME_MODE_RELATIVE ? html`
        <div class="editor-row">
          <label>${t('default_delay')}</label>
          <ha-textfield type="number" .value=${String(this._config.default_delay || '')} @change=${(e) => { const v = parseInt(e.target.value, 10); this._valueChanged('default_delay', v > 0 ? v : 15); }} min="1" max="9999"></ha-textfield>
        </div>
      ` : html`
        <div class="editor-row">
          <label>${t('default_time_hhmm')}</label>
          <ha-textfield type="time" .value=${this._config.default_at_time || ''} @input=${(e) => this._valueChanged('default_at_time', e.target.value)} placeholder="e.g. 17:30"></ha-textfield>
        </div>
      `}
      <div class="editor-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--divider-color);">
        <label>${t('targets_and_actions')}</label>
        <div class="hint">
          ${t('targets_hint_1')} <strong>${t('targets_hint_bold_1')}</strong> ${t('targets_hint_2')} <strong>${t('targets_hint_bold_2')}</strong> ${t('targets_hint_3')}
        </div>
        ${targets.map((tgt, i) => renderTarget(tgt, i))}
        <button type="button" class="add-target-btn" @click=${() => this._addTarget('finish')}>
          <ha-icon icon="mdi:plus" style="--mdc-icon-size: 18px;"></ha-icon>
          ${t('add_target')}
        </button>
      </div>
      <div class="inline-row">
        <div class="editor-row switch-row">
          <label>${t('ha_notification')}</label>
          <ha-switch .checked=${this._config.notify_ha === true} @change=${(e) => this._valueChanged('notify_ha', e.target.checked)}></ha-switch>
        </div>
      </div>
      <div class="editor-row">
        <label>${t('mobile_notification_devices')}</label>
        <ha-selector .hass=${this.hass} .selector=${{ device: { filter: [{ integration: 'mobile_app' }], multiple: true } }} .value=${this._config.notify_devices || []} @value-changed=${(e) => this._valueChanged('notify_devices', e.detail.value || [])}></ha-selector>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;
    updateLanguage(this.hass);

    const appearanceSection = html`
      <div class="editor-row">
        <label>${t('display_mode')}</label>
        <ha-select .value=${this._config.mode || 'compact'} @selected=${(e) => this._valueChanged('mode', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          <ha-list-item value="compact">${t('compact_tile')}</ha-list-item>
          <ha-list-item value="full">${t('full')}</ha-list-item>
        </ha-select>
      </div>
      <div class="inline-row">
        <div class="editor-row" style="margin-top: 8px;">
          <ha-formfield label="${t('show_progress_bar')}">
            <ha-switch .checked=${this._config.show_progress_bar === true} @change=${(e) => this._valueChanged('show_progress_bar', e.target.checked)}></ha-switch>
          </ha-formfield>
        </div>
        <div class="editor-row"><ha-formfield label="${t('show_badge')}"><ha-switch .checked=${this._config.show_badge !== false} @change=${(e) => this._valueChanged('show_badge', e.target.checked)}></ha-switch></ha-formfield></div>
      </div>
      <div class="editor-row">
        <label>${t('icon')}</label>
        <ha-icon-picker .hass=${this.hass} .value=${this._config.icon || ''} @value-changed=${(e) => this._valueChanged('icon', e.detail.value)}></ha-icon-picker>
      </div>
      <div class="editor-row">
        <label>${t('icon_color')}</label>
        <div class="switch-row" style="margin-bottom: 8px;">
          <label style="text-transform: none; font-size: 14px; font-weight: normal;">${t('color_auto')}</label>
          <ha-switch .checked=${(this._config.color || 'state') === 'state'}
            @change=${(e) => this._valueChanged('color', e.target.checked ? 'state' : 'primary')}></ha-switch>
        </div>
        ${(this._config.color || 'state') !== 'state' ? html`
          <ha-selector .hass=${this.hass} .selector=${{ "ui-color": {} }} .value=${this._config.color}
            @value-changed=${(e) => this._valueChanged('color', e.detail.value)}></ha-selector>
        ` : ''}
      </div>
      <div class="inline-row">
        <div class="editor-row">
          <label>${t('primary_info')}</label>
          <ha-select .value=${this._config.primary_info || 'name'} @selected=${(e) => this._valueChanged('primary_info', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${Object.keys(PRIMARY_INFO_OPTIONS).map(k => html`<ha-list-item value="${k}">${t('pi_' + k.replace(/-/g, '_'))}</ha-list-item>`)}
          </ha-select>
        </div>
        <div class="editor-row">
          <label>${t('secondary_info')}</label>
          <ha-select .value=${this._config.secondary_info || 'timer'} @selected=${(e) => this._valueChanged('secondary_info', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${Object.keys(SECONDARY_INFO_OPTIONS).map(k => html`<ha-list-item value="${k}">${t('si_' + k)}</ha-list-item>`)}
          </ha-select>
        </div>
      </div>
      <div class="editor-row">
        <label>${t('inactive_style')}</label>
        <ha-select .value=${this._config.inactive_style || 'dim'} @selected=${(e) => this._valueChanged('inactive_style', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          <ha-list-item value="none">${t('inactive_none')}</ha-list-item>
          <ha-list-item value="dim">${t('inactive_dim')}</ha-list-item>
          <ha-list-item value="grayscale">${t('inactive_grayscale')}</ha-list-item>
        </ha-select>
      </div>
    `;

    const interactionsSection = html`
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-tap"></ha-icon>
        <span class="action-label">${t('tap')}</span>
        <ha-select .value=${this._config.tap_action?.action || 'toggle-timer'} @selected=${(e) => this._actionChanged('tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.keys(ACTION_TYPES).map(k => html`<ha-list-item value="${k}">${t('action_' + k.replace(/-/g, '_'))}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-tap-hold"></ha-icon>
        <span class="action-label">${t('hold')}</span>
        <ha-select .value=${this._config.hold_action?.action || 'settings'} @selected=${(e) => this._actionChanged('hold_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.keys(ACTION_TYPES).map(k => html`<ha-list-item value="${k}">${t('action_' + k.replace(/-/g, '_'))}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:circle-outline"></ha-icon>
        <span class="action-label">${t('icon_tap')}</span>
        <ha-select .value=${this._config.icon_tap_action?.action || 'settings'} @selected=${(e) => this._actionChanged('icon_tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.keys(ACTION_TYPES).map(k => html`<ha-list-item value="${k}">${t('action_' + k.replace(/-/g, '_'))}</ha-list-item>`)}
        </ha-select>
      </div>
    `;

    return html`
      <div class="editor-container">
        ${this._renderSection('targets', 'mdi:target', t('targets_and_timer'), this._renderTargetsSection())}
        ${this._renderSection('appearance', 'mdi:palette', t('appearance'), appearanceSection)}
        ${this._renderSection('interactions', 'mdi:gesture-tap', t('interactions'), interactionsSection)}
      </div>
    `;
  }
}

customElements.define('quick-timer-card-editor', QuickTimerCardEditor);

// ============================================
// Quick Timer Card
// ============================================

class QuickTimerCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _delay: { type: Number },
      _unit: { type: String },
      _timeMode: { type: String },
      _atTime: { type: String },
      _isScheduled: { type: Boolean },
      _remainingSeconds: { type: Number },
      _endTimestamp: { type: Number },
      _startTimestamp: { type: Number },
      _progress: { type: Number },
      _currentTaskId: { type: String },
      _loading: { type: Boolean },
      _showSettings: { type: Boolean },
      _notifyHa: { type: Boolean },
      _notifyDevices: { type: Array },
      _history: { type: Array },
      _showHistory: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._delay = 15;
    this._unit = 'minutes';
    this._timeMode = TIME_MODE_RELATIVE;
    this._atTime = getDefaultAbsoluteTime();
    this._isScheduled = false;
    this._remainingSeconds = 0;
    this._endTimestamp = 0;
    this._startTimestamp = 0;
    this._progress = 0;
    this._currentTaskId = null;
    this._countdownInterval = null;
    this._loading = false;
    this._showSettings = false;
    this._notifyHa = false;
    this._notifyDevices = [];
    this._history = [];
    this._showHistory = false;
    this._pressTimer = null;
    this._tapCount = 0;
    this._tapTimer = null;
  }

  static getConfigElement() { return document.createElement('quick-timer-card-editor'); }
  static getStubConfig() {
    return { ...DEFAULT_CONFIG, card_id: generateCardId(), targets: [{ entity: '', service: '', data: {}, phase: 'finish' }] };
  }

  static get styles() {
    return css`
      :host { display: block; }
      ha-card.compact { padding: 0; cursor: pointer; transition: transform 180ms ease-in-out; user-select: none; position: relative; overflow: hidden; --tile-color: var(--icon-color, var(--state-icon-color, var(--secondary-text-color))); }
      ha-card.compact:hover { transform: scale(1.02); }
      ha-card.compact:active { transform: scale(0.98); }
      ha-card.compact.inactive-dim { opacity: 0.5; }
      ha-card.compact.inactive-grayscale { filter: grayscale(0.8); opacity: 0.6; }
      .compact-row { display: flex; align-items: center; gap: 10px; padding: 10px; }
      .compact-icon-container { position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--tile-color) 20%, transparent); transition: transform 180ms ease-in-out; }
      .compact-icon-container:hover { transform: scale(1.1); }
      .compact-icon { --mdc-icon-size: 20px; color: var(--tile-color); }
      .compact-icon.scheduled { animation: pulse-timer 2s ease-in-out infinite; }
      @keyframes pulse-timer { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      .compact-badge { position: absolute; bottom: -4px; right: -6px; min-width: 18px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--tile-color); color: var(--card-background-color, white); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
      .compact-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .compact-primary { font-size: 14px; font-weight: 500; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 20px; }
      .compact-secondary { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 16px; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
      .compact-secondary .highlight { color: var(--tile-color); font-weight: 500; }
      ha-card.full { padding: 16px; }
      .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
      .header ha-icon { --mdc-icon-size: 24px; color: var(--icon-color, var(--primary-color)); }
      .header h2 { margin: 0; font-size: 18px; font-weight: 500; flex: 1; }
      .entity-name { font-size: 13px; color: var(--secondary-text-color); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
      .entity-state { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; text-transform: uppercase; }
      .entity-state.on { background: var(--success-color, #4caf50); color: white; }
      .entity-state.off { background: var(--disabled-text-color, #9e9e9e); color: white; }
      .countdown-container { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 16px; background: rgba(var(--rgb-primary-color), 0.1); border-radius: 12px; border: 1px solid var(--primary-color); }
      .countdown-icon { --mdc-icon-size: 28px; color: var(--primary-color); animation: pulse-icon 1.5s ease-in-out infinite; }
      @keyframes pulse-icon { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      .countdown-info { flex: 1; }
      .countdown-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 2px; }
      .countdown-time { font-family: 'Roboto Mono', monospace; font-size: 20px; font-weight: 600; color: var(--primary-color); }
      .countdown-action { font-size: 11px; color: var(--secondary-text-color); padding: 4px 10px; border: 1px solid var(--divider-color); border-radius: 6px; background: var(--card-background-color); }
      .countdown-cancel-btn { padding: 10px 20px; border: none; border-radius: 8px; background: var(--error-color, #db4437); color: white; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .countdown-cancel-btn:hover:not(:disabled) { opacity: 0.9; }
      .countdown-cancel-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .timer-controls { display: flex; flex-direction: column; gap: 12px; }
      .timer-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .timer-chip { padding: 6px 12px; border: 1px solid var(--divider-color); border-radius: 16px; background: transparent; color: var(--primary-text-color); font-size: 12px; cursor: pointer; transition: all 0.2s; }
      .timer-chip:hover, .timer-chip.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
      .timer-row { display: flex; gap: 8px; align-items: center; }
      .timer-input { flex: 1; padding: 10px 14px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 16px; min-width: 0; box-sizing: border-box; }
      .timer-input:focus { outline: none; border-color: var(--primary-color); }
      .timer-select { padding: 10px 14px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 14px; cursor: pointer; min-width: 100px; color-scheme: light dark; }
      .timer-select option { background: var(--card-background-color, var(--secondary-background-color)); color: var(--primary-text-color); }
      .timer-notify { display: flex; gap: 8px; align-items: center; justify-content: center; }
      .notify-icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--divider-color); border-radius: 50%; background: transparent; color: var(--secondary-text-color); cursor: pointer; transition: all 0.2s; position: relative; }
      .notify-icon-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
      .notify-icon-btn.active { background: var(--primary-color); border-color: var(--primary-color); color: white; }
      .notify-icon-btn[disabled] { cursor: default; opacity: 0.8; }
      .notify-icon-btn ha-icon { --mdc-icon-size: 18px; }
      .notify-badge { position: absolute; top: -4px; right: -4px; background: var(--accent-color, #ff9800); color: white; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
      .timer-buttons { display: flex; gap: 8px; margin-top: 4px; }
      .timer-btn { flex: 1; padding: 12px 16px; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
      .timer-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
      .timer-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .timer-btn-primary { background: var(--primary-color); color: white; }
      .timer-btn-success { background: var(--success-color, #4caf50); color: white; }
      .settings-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .settings-dialog { background: var(--card-background-color, white); border-radius: 16px; padding: 20px; max-width: 360px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
      .settings-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--divider-color); }
      .settings-header ha-icon { --mdc-icon-size: 28px; color: var(--primary-color); }
      .settings-header .title-container { flex: 1; }
      .settings-header h3 { margin: 0; font-size: 16px; font-weight: 500; }
      .settings-header .subtitle { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
      .settings-close { --mdc-icon-size: 20px; color: var(--secondary-text-color); cursor: pointer; padding: 6px; border-radius: 50%; transition: all 0.2s; }
      .settings-close:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
      .timer-mode-row { display: flex; gap: 8px; margin-bottom: 12px; }
      .mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border: 1px solid var(--divider-color); border-radius: 10px; background: transparent; color: var(--primary-text-color); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .mode-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
      .mode-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
      .history-toggle { --mdc-icon-size: 20px; color: var(--secondary-text-color); cursor: pointer; padding: 6px; border-radius: 50%; transition: all 0.2s; }
      .history-toggle:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
      .history-toggle.active { color: var(--primary-color); }
      .history-section { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--divider-color); }
      .history-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--secondary-text-color); margin-bottom: 8px; }
      .history-items { display: flex; flex-wrap: wrap; gap: 6px; }
      .history-chip { padding: 6px 12px; border: 1px solid var(--primary-color); border-radius: 16px; background: rgba(var(--rgb-primary-color), 0.1); color: var(--primary-color); font-size: 12px; cursor: pointer; transition: all 0.2s; }
      .history-chip:hover { background: var(--primary-color); color: white; }
      .target-summary { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 12px; }
      .target-summary-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .target-summary-item ha-icon { --mdc-icon-size: 14px; color: var(--primary-color); }
      .target-summary-item .phase-badge { font-size: 9px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 600; }
      .target-summary-item .phase-badge.start { background: rgba(76,175,80,0.15); color: var(--success-color, #4caf50); }
      .target-summary-item .phase-badge.finish { background: rgba(var(--rgb-primary-color),0.1); color: var(--primary-color); }
      
      ha-card { position: relative; }
      
      .progress-bar-container {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: var(--divider-color, rgba(128, 128, 128, 0.2));
        border-bottom-left-radius: var(--ha-card-border-radius, 12px);
        border-bottom-right-radius: var(--ha-card-border-radius, 12px);
        overflow: hidden;
        z-index: 2;
      }
      .progress-bar {
        height: 100%;
        background: var(--icon-color, var(--primary-color));
        transition: width 1s linear;
        width: 0%;
      }
    `;
  }

  setConfig(config) {
    if (!(config.targets && config.targets.length > 0) && !config.entity) throw new Error(t('add_at_least_one_target'));
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Auto-generate and persist card_id if missing
    if (!this.config.card_id) {
      this.config = { ...this.config, card_id: generateCardId() };
      // Persist to YAML config
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this.config }, bubbles: true, composed: true }));
      }, 0);
    }
    this._delay = this.config.default_delay || 15;
    this._unit = this.config.default_unit || 'minutes';
    this._timeMode = this.config.default_time_mode || TIME_MODE_RELATIVE;
    this._atTime = this.config.default_at_time || getDefaultAbsoluteTime();
    this._notifyHa = this.config.notify_ha === true;
    this._notifyDevices = this.config.notify_devices || [];
  }

  getCardSize() { return this.config?.mode === 'compact' ? 1 : 4; }

  connectedCallback() {
    super.connectedCallback();
    this._countdownInterval = setInterval(() => this._updateCountdown(), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._countdownInterval) clearInterval(this._countdownInterval);
  }

  _updateCountdown() {
    if (!this._isScheduled || !this._endTimestamp) return;
    const remaining = Math.max(0, this._endTimestamp - Date.now() / 1000);
    this._remainingSeconds = remaining;
    
    if (remaining <= 0) { 
      this._isScheduled = false; 
      this._remainingSeconds = 0; 
      this._progress = 0;
    } else {
      // Výpočet percent progress baru (0% - 100%)
      if (this._startTimestamp && this._endTimestamp) {
        const total = this._endTimestamp - this._startTimestamp;
        const passed = (Date.now() / 1000) - this._startTimestamp;
        this._progress = Math.max(0, Math.min(100, (passed / total) * 100));
      }
    }
    this.requestUpdate();
  }

  updated(changedProperties) {
    if (changedProperties.has('hass')) {
      updateLanguage(this.hass);
      this._checkScheduledTask();
      this._updateCountdown();
      this._loadHistory();
    }
  }

  _loadHistory() {
    if (!this.hass) return;
    preferencesManager.updateCacheFromSensor(this.hass);
    // Use the first target entity for history lookup
    const firstEntity = this._getFirstEntity();
    if (firstEntity) {
      const prefs = preferencesManager.getFromSensor(this.hass, firstEntity);
      if (prefs?.history) this._history = prefs.history;
    }
  }

  _getFirstEntity() {
    const targets = this.config.targets || [];
    if (targets.length > 0 && targets[0].entity) return targets[0].entity;
    return this.config.entity || '';
  }

  _getCardId() {
    return this.config.card_id || this.config.entity || 'unknown';
  }

  _checkScheduledTask() {
    if (!this.hass) return;
    const monitor = this.hass.states[MONITOR_ENTITY];
    if (!monitor?.attributes?.active_tasks) { this._isScheduled = false; return; }

    const cardId = this._getCardId();
    const tasks = monitor.attributes.active_tasks;
    
    let activeTask = null;
    let activeTaskId = null;

    // Zistenie, či existuje aktívna úloha pre túto kartu
    if (tasks[cardId]) {
      activeTask = tasks[cardId];
      activeTaskId = cardId;
    } else {
      const targets = this.config.targets || [];
      if (targets.length > 0) {
        const foundTarget = targets.find(t => tasks[t.entity]);
        if (foundTarget) {
          activeTask = tasks[foundTarget.entity];
          activeTaskId = foundTarget.entity;
        }
      } else if (this.config.entity && tasks[this.config.entity]) {
        activeTask = tasks[this.config.entity];
        activeTaskId = this.config.entity;
      }
    }

    if (activeTask) {
      this._isScheduled = true;
      this._endTimestamp = activeTask.end_timestamp || 0;
      
      // Nastavenie počiatočného času pre Progress Bar
      if (this._currentTaskId !== activeTaskId || !this._startTimestamp) {
        // Pokúsi sa získať start_timestamp z backendu, ak nie je, použije aktuálny čas
        this._startTimestamp = activeTask.start_timestamp || (Date.now() / 1000);
        this._currentTaskId = activeTaskId;
      }
    } else {
      this._isScheduled = false;
      this._currentTaskId = null;
      this._progress = 0;
    }
  }

  // --- Interaction Handlers ---

  _handleCardClick(e) {
    if (e.target.closest('.compact-icon-container')) return;
    this._tapCount++;
    if (this._tapTimer) clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => {
      if (this._tapCount >= 1) this._executeAction(this.config.tap_action);
      this._tapCount = 0;
    }, 250);
  }

  _handleIconClick(e) { e.stopPropagation(); this._executeAction(this.config.icon_tap_action); }

  _handlePressStart(e) {
    if (e.target.closest('.compact-icon-container')) return;
    this._pressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      this._executeAction(this.config.hold_action);
      this._pressTimer = null;
    }, 500);
  }

  _handlePressEnd() { if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; } }

  async _executeAction(actionConfig) {
    const action = actionConfig?.action || 'none';
    switch (action) {
      case 'toggle-timer': this._isScheduled ? await this._cancelSchedule() : await this._startSchedule(); break;
      case 'settings': this._openSettings(); break;
    }
  }

  // --- Core Timer Operations ---

  async _startSchedule() {
    if (!this.hass || this._loading) return;
    this._loading = true;
    this.requestUpdate();

    try {
      const targets = this.config.targets || [];
      const { start_actions, finish_actions } = buildActionArrays(targets);

      // Legacy single entity mode - build action arrays from entity config
      if (finish_actions.length === 0 && this.config.entity) {
        const svc = getDefaultServiceForEntity(this.hass, this.config.entity);
        if (svc) {
          finish_actions.push({ service: svc, target: { entity_id: this.config.entity }, data: {} });
        }
      }

      if (finish_actions.length === 0) {
        console.error('[Quick Timer] No finish actions configured');
        this._loading = false; this.requestUpdate();
        return;
      }

      const payload = {
        task_id: this._getCardId(),
        task_label: this._getEntityInfo().name || this._getCardId(),
        finish_actions: finish_actions,
        notify_ha: this._notifyHa,
        notify_devices: this._notifyDevices,
        time_mode: this._timeMode,
      };

      if (start_actions.length > 0) payload.start_actions = start_actions;

      if (this._timeMode === TIME_MODE_ABSOLUTE) {
        payload.at_time = this._atTime;
      } else {
        payload.delay = this._delay;
        payload.unit = this._unit;
      }

      // console.log('[Quick Timer] Sending payload:', JSON.stringify(payload, null, 2));
      await this.hass.callService('quick_timer', 'run_action', payload);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (e) { console.error('[Quick Timer] Schedule failed:', e); }
    finally { this._loading = false; this.requestUpdate(); }
  }

  async _cancelSchedule() {
    if (!this.hass || this._loading) return;
    this._loading = true;
    this.requestUpdate();

    try {
      await this.hass.callService('quick_timer', 'cancel_action', { task_id: this._getCardId() });
      this._isScheduled = false;
      this._remainingSeconds = 0;
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
    } catch (e) { console.error('[Quick Timer] Cancel failed:', e); }
    finally { this._loading = false; this.requestUpdate(); }
  }

  _openSettings() { this._showSettings = true; this.requestUpdate(); }
  _closeSettings() { this._showSettings = false; this.requestUpdate(); }

  // --- Entity Info ---

  _getEntityInfo() {
    const targets = this.config.targets || [];

    // Custom name override
    if (this.config.name) {
      const firstEntity = this._getFirstEntity();
      const entity = firstEntity ? this.hass?.states?.[firstEntity] : null;
      return {
        name: this.config.name,
        state: entity?.state || 'group',
        icon: this.config.icon || entity?.attributes?.icon || 'mdi:timer-outline',
        lastChanged: entity?.last_changed, attributes: entity?.attributes || {},
      };
    }

    // Single target: show entity friendly_name
    if (targets.length === 1 && targets[0].entity) {
      const entity = this.hass?.states?.[targets[0].entity];
      return {
        name: entity?.attributes?.friendly_name || targets[0].entity,
        state: entity?.state || 'unknown',
        icon: this.config.icon || entity?.attributes?.icon || 'mdi:timer-outline',
        lastChanged: entity?.last_changed, attributes: entity?.attributes || {},
      };
    }

    // Multiple targets
    if (targets.length > 1) {
      const valid = targets.filter(tgt => tgt.entity).length;
      return {
        name: valid === 1 ? t('one_entity_scheduled') : t('n_entities_scheduled').replace('{n}', valid),
        state: 'group', icon: this.config.icon || 'mdi:timer-outline',
        lastChanged: null, attributes: {},
      };
    }

    // Legacy single entity
    const entity = this.hass?.states?.[this.config.entity];
    if (!entity) return { name: this.config.entity || t('quick_timer'), state: 'unavailable', icon: 'mdi:help-circle', lastChanged: null, attributes: {} };
    return {
      name: entity.attributes?.friendly_name || this.config.entity,
      state: entity.state,
      icon: this.config.icon || entity.attributes?.icon || 'mdi:timer-outline',
      lastChanged: entity.last_changed, attributes: entity.attributes || {},
    };
  }

  _getColor() {
    const key = this.config.color || 'state';
    if (key === 'state') {
      return this._isScheduled 
        ? 'var(--state-light-active-color, var(--warning-color, #ff9800))' 
        : 'var(--state-icon-color, #9e9e9e)';
    }
    return namedColorToCss(key) || 'var(--primary-color)';
  }

  _getPrimaryInfo() {
    const info = this._getEntityInfo();
    switch (this.config.primary_info) {
      case 'name': return info.name;
      case 'state': return localizeState(this.hass, this._getFirstEntity(), info.state);
      case 'last-changed': return info.lastChanged ? getRelativeTime(info.lastChanged) : '';
      case 'none': return '';
      default: return info.name;
    }
  }

  _getSecondaryInfo() {
    const targets = this.config.targets || [];
    const finishTargets = targets.filter(tgt => tgt.phase !== 'start');
    const label = summarizeActions(this.hass, finishTargets);

    if (this._isScheduled) return html`<span class="highlight">${label || t('timer')}</span> ${t('in')} ${formatCountdownShort(this._remainingSeconds)}`;

    switch (this.config.secondary_info) {
      case 'timer':
        if (this._timeMode === TIME_MODE_ABSOLUTE) return html`<span class="highlight">${label || t('timer')}</span> ${t('at')} ${this._atTime}`;
        return html`<span class="highlight">${label || t('timer')}</span> ${t('in')} ${this._delay} ${getUnitLabel(this._unit, true)}`;
      case 'state': { const info = this._getEntityInfo(); return localizeState(this.hass, this._getFirstEntity(), info.state); }
      case 'action': return label;
      case 'none': return '';
      default:
        if (this._timeMode === TIME_MODE_ABSOLUTE) return html`<span class="highlight">${label || t('timer')}</span> ${t('at')} ${this._atTime}`;
        return html`<span class="highlight">${label || t('timer')}</span> ${t('in')} ${this._delay} ${getUnitLabel(this._unit, true)}`;
    }
  }

  _getInactiveClass() {
    if (this._isScheduled) return '';
    const style = this.config.inactive_style || 'dim';
    return style === 'dim' ? 'inactive-dim' : style === 'grayscale' ? 'inactive-grayscale' : '';
  }

  // --- Save to config ---

  _saveToCardConfig() {
    if (!this.config) return;
    const newConfig = {
      ...this.config,
      default_delay: this._delay,
      default_unit: this._unit,
      default_time_mode: this._timeMode,
      default_at_time: this._atTime,
      notify_ha: this._notifyHa,
      notify_devices: this._notifyDevices,
    };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true, composed: true }));
    this.config = newConfig;
  }

  // --- History ---

  _formatHistoryEntry(entry) {
    const svcLabel = entry.finish_actions?.[0]?.service ? getServiceLabel(this.hass, entry.finish_actions[0].service)
                   : entry.service ? getServiceLabel(this.hass, entry.service)
                   : t('action');
    if (entry.time_mode === TIME_MODE_ABSOLUTE) return `${svcLabel} ${t('at')} ${entry.at_time}`;
    const u = { seconds: t('sec'), minutes: t('min'), hours: t('hrs') }[entry.unit] || t('min');
    return `${svcLabel} ${t('in')} ${entry.delay}${u}`;
  }

  _applyHistoryEntry(entry) {
    this._timeMode = entry.time_mode || TIME_MODE_RELATIVE;
    if (entry.time_mode === TIME_MODE_ABSOLUTE) {
      this._atTime = entry.at_time;
    } else {
      this._delay = entry.delay || 15;
      this._unit = entry.unit || 'minutes';
    }
    this._showHistory = false;
    this._saveToCardConfig();
    this.requestUpdate();
  }

  // --- Render ---

  _renderSettingsDialog() {
    if (!this._showSettings) return '';
    const info = this._getEntityInfo();
    const presets = getPresetsFromSensor(this.hass);
    const isAbsolute = this._timeMode === TIME_MODE_ABSOLUTE;
    const targets = this.config.targets || [];

    return html`
      <div class="settings-overlay" @click=${(e) => e.target === e.currentTarget && this._closeSettings()}>
        <div class="settings-dialog">
          <div class="settings-header">
            <ha-icon icon="${info.icon}"></ha-icon>
            <div class="title-container">
              <h3>${info.name}</h3>
              <div class="subtitle">${targets.length > 0 ? t('n_targets_configured').replace('{n}', targets.length) : localizeState(this.hass, this._getFirstEntity(), info.state)}</div>
            </div>
            ${this._history.length > 0 ? html`
              <ha-icon class="history-toggle ${this._showHistory ? 'active' : ''}" icon="mdi:history"
                @click=${() => { this._showHistory = !this._showHistory; this.requestUpdate(); }} title="${t('history')}"></ha-icon>
            ` : ''}
            <ha-icon class="settings-close" icon="mdi:close" @click=${this._closeSettings}></ha-icon>
          </div>

          ${this._showHistory && this._history.length > 0 ? html`
            <div class="history-section">
              <div class="history-title">${t('recent')}</div>
              <div class="history-items">
                ${this._history.slice(0, 3).map(e => html`<button class="history-chip" @click=${() => this._applyHistoryEntry(e)}>${this._formatHistoryEntry(e)}</button>`)}
              </div>
            </div>
          ` : ''}

          ${targets.length > 0 ? html`
            <div class="target-summary">
              ${targets.map(tgt => { const dataStr = formatServiceData(tgt.data, this.hass, tgt.service); return html`
                <div class="target-summary-item">
                  <ha-icon icon="mdi:target"></ha-icon>
                  <span style="flex:1; font-size: 13px;">${this.hass?.states?.[tgt.entity]?.attributes?.friendly_name || tgt.entity}</span>
                  <span class="phase-badge ${tgt.phase === 'start' ? 'start' : 'finish'}">${tgt.phase === 'start' ? t('start') : t('finish')}</span>
                  <span style="font-size: 11px; color: var(--secondary-text-color);">${getServiceLabel(this.hass, tgt.service)}${dataStr ? ` (${dataStr})` : ''}</span>
                </div>
              `; })}
            </div>
          ` : ''}

          <div class="timer-controls">
            <div class="timer-mode-row">
              <button type="button" class="mode-btn ${!isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_RELATIVE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon> ${t('delay')}
              </button>
              <button type="button" class="mode-btn ${isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_ABSOLUTE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:clock-outline" style="--mdc-icon-size: 16px;"></ha-icon> ${t('time')}
              </button>
            </div>

            ${!isAbsolute ? html`
              <div class="timer-row">
                <input type="number" class="timer-input" .value=${String(this._delay)} min="1"
                  @input=${(e) => { const v = parseInt(e.target.value, 10); if (v > 0) { this._delay = v; this._saveToCardConfig(); } }}
                  @change=${(e) => { const v = parseInt(e.target.value, 10); this._delay = v > 0 ? v : 1; e.target.value = String(this._delay); this._saveToCardConfig(); }}>
                <select class="timer-select" @change=${(e) => { this._unit = e.target.value; this._saveToCardConfig(); this.requestUpdate(); }}>
                  <option value="seconds" ?selected=${this._unit === 'seconds'}>${t('seconds')}</option>
                  <option value="minutes" ?selected=${this._unit === 'minutes'}>${t('minutes')}</option>
                  <option value="hours" ?selected=${this._unit === 'hours'}>${t('hours')}</option>
                </select>
              </div>
            ` : html`
              <div class="timer-row">
                <input type="time" class="timer-input" style="text-align: center;" .value=${this._atTime}
                  @input=${(e) => { this._atTime = e.target.value; this._saveToCardConfig(); }}>
              </div>
            `}
            <div class="timer-chips">
              ${presets[this._unit].map(val => html`
                <button type="button" class="timer-chip ${this._delay === val ? 'active' : ''}"
                  @click=${() => { this._delay = val; this._saveToCardConfig(); this.requestUpdate(); }}>
                  ${val}${getUnitLabel(this._unit, true).charAt(0)}
                </button>
              `)}
            </div>
            <div class="timer-notify">
              <button type="button" class="notify-icon-btn ${this._notifyHa ? 'active' : ''}"
                @click=${() => { this._notifyHa = !this._notifyHa; this._saveToCardConfig(); this.requestUpdate(); }} title="${t('ha_notification')}">
                <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
              </button>
              <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}"
                @click=${() => { this._notifyMobile = !this._notifyMobile; this._saveToCardConfig(); this.requestUpdate(); }} title="${t('mobile_notification')}">
                <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
              </button>
            </div>
            ${this._notifyMobile ? html`
            <div class="editor-row" style="margin-top: 8px;">
              <label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--secondary-text-color);">${t('mobile_notification_devices')}</label>
              <ha-selector .hass=${this.hass} .selector=${{ device: { filter: [{ integration: 'mobile_app' }], multiple: true } }} .value=${this._notifyDevices || []} @value-changed=${(e) => { 
                this._notifyDevices = e.detail.value || []; 
                this._saveToCardConfig(); 
                this.requestUpdate(); 
              }}></ha-selector>
            </div>
            ` : ''}
          </div>

          <div class="timer-buttons" style="margin-top: 12px;">
            <button class="timer-btn timer-btn-primary" @click=${() => { this._saveToCardConfig(); this._startSchedule(); this._closeSettings(); }} ?disabled=${this._loading}>
              <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon>
              ${this._loading ? '...' : t('schedule')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderProgressBar() {
    if (!this.config.show_progress_bar || !this._isScheduled) return html``;
    return html`
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${this._progress}%"></div>
      </div>
    `;
  }

  _renderCompactMode() {
    const info = this._getEntityInfo();
    const color = this._getColor();
    const inactiveClass = this._getInactiveClass();

    return html`
      <ha-card class="compact ${inactiveClass}" style="--icon-color: ${color};"
        @click=${this._handleCardClick}
        @mousedown=${this._handlePressStart} @mouseup=${this._handlePressEnd} @mouseleave=${this._handlePressEnd}
        @touchstart=${this._handlePressStart} @touchend=${this._handlePressEnd} @touchcancel=${this._handlePressEnd}
        @contextmenu=${(e) => e.preventDefault()}>
        <div class="compact-row">
          <div class="compact-icon-container" @click=${this._handleIconClick}>
            <ha-icon class="compact-icon ${this._isScheduled ? 'scheduled' : ''}" icon="${this._isScheduled ? 'mdi:timer-sand' : info.icon}"></ha-icon>
            ${this.config.show_badge !== false && this._isScheduled ? html`<div class="compact-badge">${formatBadgeTime(this._remainingSeconds)}</div>` : ''}
          </div>
          <div class="compact-info">
            ${this.config.primary_info !== 'none' ? html`<div class="compact-primary">${this._getPrimaryInfo()}</div>` : ''}
            ${this.config.secondary_info !== 'none' ? html`<div class="compact-secondary">${this._getSecondaryInfo()}</div>` : ''}
          </div>
        </div>
        ${this._renderProgressBar()}
      </ha-card>
      ${this._renderSettingsDialog()}
    `;
  }

  _renderFullMode() {
    const info = this._getEntityInfo();
    const color = this._getColor();
    const presets = getPresetsFromSensor(this.hass);
    const isAbsolute = this._timeMode === TIME_MODE_ABSOLUTE;
    const targets = this.config.targets || [];
    const finishTargets = targets.filter(tgt => tgt.phase !== 'start');
    const displayLabel = summarizeActions(this.hass, finishTargets);

    return html`
      <ha-card class="full" style="--icon-color: ${color};">
        <div class="header">
          <ha-icon icon="${info.icon}"></ha-icon>
          <h2>${info.name || t('quick_timer')}</h2>
          ${this._history.length > 0 ? html`
            <ha-icon class="history-toggle ${this._showHistory ? 'active' : ''}" icon="mdi:history"
              @click=${() => { this._showHistory = !this._showHistory; this.requestUpdate(); }} title="${t('history')}"></ha-icon>
          ` : ''}
        </div>

        ${targets.length > 0 ? html`
          <div class="target-summary">
            ${targets.map(tgt => { const dataStr = formatServiceData(tgt.data, this.hass, tgt.service); return html`
              <div class="target-summary-item">
                <ha-icon icon="mdi:target"></ha-icon>
                <span style="flex:1;">${this.hass?.states?.[tgt.entity]?.attributes?.friendly_name || tgt.entity}</span>
                <span class="phase-badge ${tgt.phase === 'start' ? 'start' : 'finish'}">${tgt.phase === 'start' ? t('start') : t('finish')}</span>
                <span style="font-size: 11px; color: var(--secondary-text-color);">${getServiceLabel(this.hass, tgt.service)}${dataStr ? ` (${dataStr})` : ''}</span>
              </div>
            `; })}
          </div>
        ` : html`
          <div class="entity-name">${info.name} <span class="entity-state ${info.state}">${localizeState(this.hass, this._getFirstEntity(), info.state)}</span></div>
        `}

        ${this._showHistory && this._history.length > 0 ? html`
          <div class="history-section">
            <div class="history-title">${t('recent')}</div>
            <div class="history-items">
              ${this._history.slice(0, 3).map(e => html`<button class="history-chip" @click=${() => this._applyHistoryEntry(e)}>${this._formatHistoryEntry(e)}</button>`)}
            </div>
          </div>
        ` : ''}

        ${this._isScheduled ? html`
          <div class="countdown-container">
            <ha-icon class="countdown-icon" icon="mdi:timer-sand"></ha-icon>
            <div class="countdown-info">
              <div class="countdown-label">${t('countdown_to_action')}</div>
              <div class="countdown-time">${formatCountdown(this._remainingSeconds)}</div>
            </div>
            <div class="countdown-action">${displayLabel}</div>
            <button class="countdown-cancel-btn" @click=${() => this._cancelSchedule()} ?disabled=${this._loading}>${this._loading ? '...' : t('cancel')}</button>
          </div>
        ` : html`
          <div class="timer-controls">
            <div class="timer-mode-row">
              <button type="button" class="mode-btn ${!isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_RELATIVE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon> ${t('delay')}
              </button>
              <button type="button" class="mode-btn ${isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_ABSOLUTE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:clock-outline" style="--mdc-icon-size: 16px;"></ha-icon> ${t('time')}
              </button>
            </div>
            ${!isAbsolute ? html`
              <div class="timer-row">
                <input type="number" class="timer-input" .value=${String(this._delay)}
                  @input=${(e) => { const v = parseInt(e.target.value, 10); if (v > 0) { this._delay = v; this._saveToCardConfig(); } }}
                  @change=${(e) => { const v = parseInt(e.target.value, 10); this._delay = v > 0 ? v : 1; e.target.value = String(this._delay); this._saveToCardConfig(); }} min="1">
                <select class="timer-select" @change=${(e) => { this._unit = e.target.value; this._saveToCardConfig(); this.requestUpdate(); }}>
                  <option value="seconds" ?selected=${this._unit === 'seconds'}>${t('seconds')}</option>
                  <option value="minutes" ?selected=${this._unit === 'minutes'}>${t('minutes')}</option>
                  <option value="hours" ?selected=${this._unit === 'hours'}>${t('hours')}</option>
                </select>
              </div>
            ` : html`
              <div class="timer-row">
                <input type="time" class="timer-input" style="text-align: center;" .value=${this._atTime}
                  @input=${(e) => { this._atTime = e.target.value; this._saveToCardConfig(); }}>
              </div>
            `}
            <div class="timer-chips">
              ${presets[this._unit].map(val => html`
                <button type="button" class="timer-chip ${this._delay === val ? 'active' : ''}"
                  @click=${() => { this._delay = val; this._saveToCardConfig(); this.requestUpdate(); }}>
                  ${val}${getUnitLabel(this._unit, true).charAt(0)}
                </button>
              `)}
            </div>
            <div class="timer-notify">
              <button type="button" class="notify-icon-btn ${this._notifyHa ? 'active' : ''}"
                @click=${() => { this._notifyHa = !this._notifyHa; this._saveToCardConfig(); this.requestUpdate(); }} title="${t('ha_notification')}">
                <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
              </button>
              <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}"
                @click=${() => { this._notifyMobile = !this._notifyMobile; this._saveToCardConfig(); this.requestUpdate(); }} title="${t('mobile_notification')}">
                <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
              </button>
            </div>
            ${this._notifyMobile ? html`
            <div style="margin-top: 8px;">
              <label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--secondary-text-color);">${t('mobile_notification_devices')}</label>
              <ha-selector .hass=${this.hass} .selector=${{ device: { filter: [{ integration: 'mobile_app' }], multiple: true } }} .value=${this._notifyDevices || []} @value-changed=${(e) => { this._notifyDevices = e.detail.value || []; this._saveToCardConfig(); this.requestUpdate(); }}></ha-selector>
            </div>
            ` : ''}
            <div class="timer-buttons">
              <button class="timer-btn timer-btn-primary" @click=${() => { this._saveToCardConfig(); this._startSchedule(); }} ?disabled=${this._loading}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 18px;"></ha-icon>
                ${this._loading ? '...' : t('schedule')}
              </button>
            </div>
          </div>
        `}
        ${this._renderProgressBar()}
      </ha-card>
      ${this._renderSettingsDialog()}
    `;
  }

  render() {
    if (!this.hass || !this.config) return html``;
    return this.config.mode === 'compact' ? this._renderCompactMode() : this._renderFullMode();
  }
}

customElements.define('quick-timer-card', QuickTimerCard);

// ============================================
// Quick Timer Overview Card Editor
// ============================================

class QuickTimerOverviewCardEditor extends LitElement {
  static get properties() {
    return { hass: { type: Object }, _config: { type: Object } };
  }

  setConfig(config) { this._config = config || {}; }

  _fireConfigChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _valueChanged(key, value) {
    this._config = { ...this._config, [key]: value };
    this._fireConfigChanged();
  }

  static get styles() {
    return css`
      .editor-row { margin-bottom: 16px; }
      .editor-row label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; }
      ha-textfield { width: 100%; display: block; }
      .switch-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; }
      .switch-row label { margin-bottom: 0; flex: 1; }
    `;
  }

  render() {
    if (!this._config) return html``;
    return html`
      <div>
        <div class="editor-row">
          <label>${t('card_title')}</label>
          <ha-textfield
            .value=${this._config.title || ''}
            placeholder="${t('quick_timers')}"
            @input=${(e) => this._valueChanged('title', e.target.value)}>
          </ha-textfield>
        </div>
        <div class="editor-row switch-row">
          <label>${t('hide_when_empty')}</label>
          <ha-switch
            .checked=${this._config.hide_when_empty === true}
            @change=${(e) => this._valueChanged('hide_when_empty', e.target.checked)}>
          </ha-switch>
        </div>
      </div>
    `;
  }
}

customElements.define('quick-timer-overview-card-editor', QuickTimerOverviewCardEditor);

// ============================================
// Quick Timer Overview Card
// ============================================

class QuickTimerOverviewCard extends LitElement {
  static get properties() {
    return { hass: { type: Object }, config: { type: Object }, _tasks: { type: Object } };
  }

  constructor() { super(); this._tasks = {}; this._updateInterval = null; }

  static get styles() {
    return css`
      :host { display: block; }
      ha-card { padding: 16px; }
      .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
      .header ha-icon { --mdc-icon-size: 24px; color: var(--primary-color); }
      .header h2 { margin: 0; font-size: 18px; font-weight: 500; flex: 1; }
      .task-count { background: var(--primary-color); color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      .no-tasks { text-align: center; padding: 24px; color: var(--secondary-text-color); }
      .no-tasks ha-icon { --mdc-icon-size: 48px; opacity: 0.5; margin-bottom: 12px; }
      .task-list { display: flex; flex-direction: column; gap: 12px; }
      .task-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--secondary-background-color); border-radius: 8px; border-left: 4px solid var(--primary-color); }
      .task-icon { --mdc-icon-size: 24px; color: var(--primary-color); }
      .task-info { flex: 1; min-width: 0; }
      .task-entity { font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .task-details { font-size: 12px; color: var(--secondary-text-color); display: flex; gap: 8px; margin-top: 4px; }
      .task-action { padding: 2px 6px; background: var(--primary-color); color: white; border-radius: 4px; font-size: 10px; font-weight: 500; text-transform: uppercase; }
      .task-countdown { font-family: 'Roboto Mono', monospace; font-weight: 600; font-size: 18px; color: var(--primary-color); min-width: 80px; text-align: right; }
      .task-cancel { padding: 8px; border: none; border-radius: 50%; background: transparent; color: var(--error-color, #db4437); cursor: pointer; transition: all 0.2s; }
      .task-cancel:hover:not(:disabled) { background: var(--error-color, #db4437); color: white; }
      .task-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
      .task-cancel ha-icon { --mdc-icon-size: 18px; }
    `;
  }

  setConfig(config) { this.config = config; }
  static getConfigElement() { return document.createElement('quick-timer-overview-card-editor'); }
  static getStubConfig() { return { title: '', hide_when_empty: false }; }
  getCardSize() { return 3; }

  connectedCallback() { super.connectedCallback(); this._updateInterval = setInterval(() => this.requestUpdate(), 1000); }
  disconnectedCallback() { super.disconnectedCallback(); if (this._updateInterval) clearInterval(this._updateInterval); }

  updated(changedProperties) {
    if (changedProperties.has('hass')) {
      updateLanguage(this.hass);
      this._tasks = this.hass?.states[MONITOR_ENTITY]?.attributes?.active_tasks || {};
    }
  }

  _getRemainingSeconds(task) {
    if (!task.end_timestamp) return 0;
    return Math.max(0, task.end_timestamp - Date.now() / 1000);
  }

  _getTaskLabel(taskId, task) {
    // Prefer task_label (sent by card)
    if (task.task_label) return task.task_label;
    // Try to get friendly name from finish_actions
    if (task.finish_actions?.length > 0) {
      const firstTarget = task.finish_actions[0]?.target?.entity_id;
      if (firstTarget) {
        const friendlyName = this.hass?.states?.[firstTarget]?.attributes?.friendly_name || firstTarget;
        // If task_id is NOT the entity_id itself (card tasks), prefix with task_id info
        if (taskId !== firstTarget && !taskId.startsWith('qt_')) return friendlyName;
        if (taskId !== firstTarget) return `${friendlyName} (${taskId.substring(0, 10)})`;
        return friendlyName;
      }
    }
    // Fallback: use task_id or entity_id
    if (taskId.includes('.')) return this.hass?.states?.[taskId]?.attributes?.friendly_name || taskId;
    return taskId;
  }

  _getTaskAction(task) {
    if (task.finish_actions?.length > 0) {
      return getServiceLabel(this.hass, task.finish_actions[0].service);
    }
    return getServiceLabel(this.hass, task.service || task.action || '');
  }

  async _cancelTask(taskId, e) {
    if (!this.hass) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await this.hass.callService('quick_timer', 'cancel_action', { task_id: taskId });
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
    } catch (e) { console.error('[Quick Timer] Cancel failed:', e); }
    finally { btn.disabled = false; }
  }

  render() {
    if (!this.hass) return html``;
    const entries = Object.entries(this._tasks);

    // Hide when empty: render nothing if no active timers and option enabled
    if (this.config?.hide_when_empty && entries.length === 0) {
      return html``;
    }

    return html`
      <ha-card>
        <div class="header">
          <ha-icon icon="mdi:calendar-clock"></ha-icon>
          <h2>${this.config?.title || t('quick_timers')}</h2>
          ${entries.length > 0 ? html`<span class="task-count">${entries.length}</span>` : ''}
        </div>
        ${entries.length === 0 ? html`
          <div class="no-tasks"><ha-icon icon="mdi:calendar-check"></ha-icon><div>${t('no_active_timers')}</div></div>
        ` : html`
          <div class="task-list">
            ${entries.map(([id, task]) => html`
              <div class="task-item">
                <ha-icon class="task-icon" icon="mdi:clock-fast"></ha-icon>
                <div class="task-info">
                  <div class="task-entity">${this._getTaskLabel(id, task)}</div>
                  <div class="task-details"><span class="task-action">${this._getTaskAction(task)}</span></div>
                </div>
                <div class="task-countdown">${formatCountdown(this._getRemainingSeconds(task))}</div>
                <button class="task-cancel" @click=${(e) => this._cancelTask(id, e)}><ha-icon icon="mdi:close"></ha-icon></button>
              </div>
            `)}
          </div>
        `}
      </ha-card>
    `;
  }
}

customElements.define('quick-timer-overview-card', QuickTimerOverviewCard);

// ============================================
// Card Registration
// ============================================

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'quick-timer-card',
  name: 'Quick Timer Card',
  description: 'Professional timer card with multi-target actions, dynamic presets, and unique card IDs.',
  preview: true,
  configurable: true,
  documentationURL: 'https://github.com/jozefnad/homeassistant-quick_timer',
});
window.customCards.push({
  type: 'quick-timer-overview-card',
  name: 'Quick Timer Overview',
  description: 'Dashboard card showing all active scheduled tasks.',
  preview: true,
  configurable: true,
  documentationURL: 'https://github.com/jozefnad/homeassistant-quick_timer',
});

console.info(
  `%c QUICK-TIMER %c v${CARD_VERSION} `,
  'color: white; background: #039be5; font-weight: bold; border-radius: 4px 0 0 4px;',
  'color: #039be5; background: white; font-weight: bold; border-radius: 0 4px 4px 0;'
);

// ============================================
// Dialog Injection (Collapsible Panel)
// ============================================

function isSupportedForQuickTimer(hass, entityId) {
  if (!hass || !entityId) return false;
  const domain = entityId.split('.')[0];
  return hass.services?.[domain] && Object.keys(hass.services[domain]).length > 0;
}

const INJECTED_PANEL_ID = 'quick-timer-dialog-panel';

class QuickTimerDialogInjector {
  constructor() {
    this._injecting = false;
    this._lastEntityId = null;
    this._observers = [];
    this._retryCount = 0;
    this._maxRetries = 50;
    this._init();
  }

  _init() {
    console.log('[Quick Timer] Dialog Injector initializing...');
    this._setupObserver();
  }

  _setupObserver() {
    const waitForHA = () => {
      const ha = document.querySelector('home-assistant');
      if (!ha) { setTimeout(waitForHA, 100); return; }

      const haObserver = new MutationObserver(() => this._scheduleInjection());
      haObserver.observe(ha, { childList: true, subtree: true, attributes: true });
      this._observers.push(haObserver);

      if (ha.shadowRoot) {
        const shadowObserver = new MutationObserver(() => this._scheduleInjection());
        shadowObserver.observe(ha.shadowRoot, { childList: true, subtree: true });
        this._observers.push(shadowObserver);
      }

      document.body.addEventListener('hass-more-info', () => { this._retryCount = 0; this._retryInjection(); });
      ha.addEventListener('hass-more-info', () => { this._retryCount = 0; this._retryInjection(); });

      // console.log('[Quick Timer] Dialog observers initialized');
      this._scheduleInjection();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForHA);
    else waitForHA();
  }

  _retryInjection() {
    if (this._retryCount >= this._maxRetries) return;
    this._retryCount++;
    setTimeout(() => {
      this._tryInject();
      if (!this._lastEntityId && this._retryCount < this._maxRetries) this._retryInjection();
    }, 50);
  }

  _scheduleInjection() {
    if (this._injecting) return;
    requestAnimationFrame(() => this._tryInject());
  }

  _getHass() { return document.querySelector('home-assistant')?.hass; }

  _getActiveTask(entityId) {
    const hass = this._getHass();
    if (!hass) return null;
    return hass.states[MONITOR_ENTITY]?.attributes?.active_tasks?.[entityId] || null;
  }

  _findMoreInfoContent() {
    const ha = document.querySelector('home-assistant');
    if (!ha?.shadowRoot) return null;

    const paths = [
      () => {
        const dialog = ha.shadowRoot.querySelector('ha-more-info-dialog');
        if (!dialog?.shadowRoot) return null;
        const haDialog = dialog.shadowRoot.querySelector('ha-dialog');
        if (!haDialog) return null;
        const moreInfoInfo = haDialog.querySelector('ha-more-info-info');
        if (!moreInfoInfo?.shadowRoot) return null;
        const content = moreInfoInfo.shadowRoot.querySelector('.content');
        const entityId = dialog.entityId || moreInfoInfo.entityId;
        return content && entityId ? { target: content, entityId } : null;
      },
      () => {
        const dialog = ha.shadowRoot.querySelector('ha-more-info-dialog');
        if (!dialog?.shadowRoot) return null;
        const haDialog = dialog.shadowRoot.querySelector('ha-dialog');
        if (!haDialog) return null;
        const moreInfoContent = haDialog.querySelector('ha-more-info-info, more-info-content');
        if (!moreInfoContent?.shadowRoot) return null;
        const content = moreInfoContent.shadowRoot.querySelector('.content, div[class*="content"]');
        const entityId = dialog.entityId || moreInfoContent.entityId;
        return content && entityId ? { target: content, entityId } : null;
      },
      () => {
        const dialog = ha.shadowRoot.querySelector('ha-more-info-dialog');
        if (!dialog) return null;
        const entityId = dialog.entityId;
        if (!entityId) return null;
        const findContent = (root, depth = 0) => {
          if (depth > 5 || !root) return null;
          const c = root.querySelector?.('.content');
          if (c) return c;
          if (root.shadowRoot) { const sc = findContent(root.shadowRoot, depth + 1); if (sc) return sc; }
          for (const child of (root.children || [])) { const cc = findContent(child, depth + 1); if (cc) return cc; }
          return null;
        };
        const content = findContent(dialog);
        return content && entityId ? { target: content, entityId } : null;
      }
    ];

    for (const pathFn of paths) {
      try { const r = pathFn(); if (r) return r; } catch (e) { /* continue */ }
    }
    return null;
  }

  _tryInject() {
    if (this._injecting) return;
    this._injecting = true;
    try {
      const result = this._findMoreInfoContent();
      if (!result) { this._cleanup(); return; }
      const { target, entityId } = result;
      const hass = this._getHass();
      updateLanguage(hass);
      if (!isSupportedForQuickTimer(hass, entityId)) { this._removePanel(target); return; }

      const existingPanel = target.querySelector(`#${INJECTED_PANEL_ID}`);
      if (existingPanel) {
        if (existingPanel.dataset.entityId === entityId) { this._updatePanelState(existingPanel, entityId); return; }
        else { this._removePanel(target); }
      }

      this._injectPanel(target, entityId);
      this._lastEntityId = entityId;
      // console.log(`[Quick Timer] Panel injected for ${entityId}`);
    } finally { this._injecting = false; }
  }

  _removePanel(target) {
    const panel = target?.querySelector(`#${INJECTED_PANEL_ID}`);
    if (panel) { if (panel._countdownInterval) clearInterval(panel._countdownInterval); panel.remove(); }
    this._lastEntityId = null;
  }

  _cleanup() { this._lastEntityId = null; }

  _updatePanelState(panel, entityId) {
    const task = this._getActiveTask(entityId);
    const controlsDiv = panel.querySelector('.qt-controls');
    const countdownDiv = panel.querySelector('.qt-countdown');

    if (task) {
      panel.classList.add('expanded');
      if (controlsDiv) controlsDiv.style.display = 'none';
      if (countdownDiv) countdownDiv.style.display = 'flex';
      this._updateCountdownDisplay(panel, task);
      this._ensurePanelCountdownInterval(panel, entityId);
    } else {
      if (countdownDiv) countdownDiv.style.display = 'none';
      if (controlsDiv) controlsDiv.style.display = panel.classList.contains('expanded') ? 'flex' : 'none';
      if (panel._countdownInterval) { clearInterval(panel._countdownInterval); panel._countdownInterval = null; }
    }
  }

  _ensurePanelCountdownInterval(panel, entityId) {
    if (panel._countdownInterval) clearInterval(panel._countdownInterval);
    panel._countdownInterval = setInterval(() => {
      const task = this._getActiveTask(entityId);
      if (task) this._updateCountdownDisplay(panel, task);
      else this._updatePanelState(panel, entityId);
    }, 1000);
  }

  _updateCountdownDisplay(panel, task) {
    const timeDisplay = panel.querySelector('.qt-countdown-time');
    const actionLabel = panel.querySelector('.qt-countdown-action');
    if (!task.end_timestamp) return;
    const remaining = Math.max(0, task.end_timestamp - Date.now() / 1000);
    if (timeDisplay) timeDisplay.textContent = formatCountdown(remaining);
    if (actionLabel) {
      // Show finish_actions label if available
      if (task.finish_actions?.length > 0) {
        actionLabel.textContent = getServiceLabel(this._getHass(), task.finish_actions[0].service);
      } else {
        actionLabel.textContent = getServiceLabel(this._getHass(), task.service || task.action);
      }
    }
    if (remaining <= 0) {
      if (panel._countdownInterval) { clearInterval(panel._countdownInterval); panel._countdownInterval = null; }
      const eid = panel.dataset.entityId;
      if (eid) setTimeout(() => this._updatePanelState(panel, eid), 500);
    }
  }

  _injectPanel(target, entityId) {
    const task = this._getActiveTask(entityId);
    const hasActiveTask = !!task;
    const hass = this._getHass();
    const entityServices = getServicesForEntity(hass, entityId);
    const serviceOptionsHtml = entityServices.map(s => `<option value="${s.value}">${s.label}</option>`).join('');

    // Load preferences
    preferencesManager.updateCacheFromSensor(hass);
    const prefs = preferencesManager.getFromSensor(hass, entityId);
    const initialTimeMode = prefs.last_time_mode || TIME_MODE_RELATIVE;
    const initialService = prefs.last_service || entityServices[0]?.value || '';
    const initialDelay = prefs.last_delay || 15;
    const initialUnit = prefs.last_unit || 'minutes';
    const initialAtTime = prefs.last_at_time || getDefaultAbsoluteTime();
    const initialNotifyHa = prefs.notify_ha || false;
    const initialNotifyMobile = prefs.notify_mobile || false;
    const history = prefs.history || [];

    const panel = document.createElement('div');
    panel.id = INJECTED_PANEL_ID;
    panel.dataset.entityId = entityId;
    panel.dataset.timeMode = initialTimeMode;
    if (hasActiveTask) panel.classList.add('expanded');

    panel.innerHTML = `
      <style>
        #${INJECTED_PANEL_ID} { border-top: 1px solid var(--divider-color); margin-top: 12px; }
        #${INJECTED_PANEL_ID} .qt-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; cursor: pointer; user-select: none; transition: background 0.2s; }
        #${INJECTED_PANEL_ID} .qt-header:hover { background: var(--secondary-background-color); }
        #${INJECTED_PANEL_ID} .qt-header ha-icon { color: var(--primary-color); --mdc-icon-size: 20px; }
        #${INJECTED_PANEL_ID} .qt-header span { flex: 1; font-weight: 500; font-size: 14px; }
        #${INJECTED_PANEL_ID} .qt-header .qt-history-btn { --mdc-icon-size: 18px; color: var(--secondary-text-color); cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-header .qt-history-btn:hover { background: var(--secondary-background-color); color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-header .qt-history-btn.active { color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-header .qt-chevron { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.2s; }
        #${INJECTED_PANEL_ID}.expanded .qt-header .qt-chevron { transform: rotate(180deg); }
        #${INJECTED_PANEL_ID} .qt-body { display: none; padding: 0 16px 16px; }
        #${INJECTED_PANEL_ID}.expanded .qt-body { display: block; }
        #${INJECTED_PANEL_ID} .qt-history { display: none; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--divider-color); }
        #${INJECTED_PANEL_ID} .qt-history.visible { display: block; }
        #${INJECTED_PANEL_ID} .qt-history-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--secondary-text-color); margin-bottom: 6px; }
        #${INJECTED_PANEL_ID} .qt-history-items { display: flex; flex-wrap: wrap; gap: 6px; }
        #${INJECTED_PANEL_ID} .qt-history-chip { padding: 5px 10px; border: 1px solid var(--primary-color); border-radius: 16px; background: rgba(var(--rgb-primary-color), 0.1); color: var(--primary-color); font-size: 11px; cursor: pointer; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-history-chip:hover { background: var(--primary-color); color: white; }
        #${INJECTED_PANEL_ID} .qt-countdown { display: ${hasActiveTask ? 'flex' : 'none'}; align-items: center; gap: 12px; padding: 10px; background: rgba(var(--rgb-primary-color), 0.1); border-radius: 10px; margin-bottom: 12px; }
        #${INJECTED_PANEL_ID} .qt-countdown-icon { --mdc-icon-size: 24px; color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-countdown-info { flex: 1; }
        #${INJECTED_PANEL_ID} .qt-countdown-time { font-family: 'Roboto Mono', monospace; font-size: 18px; font-weight: 600; color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-countdown-action { font-size: 11px; color: var(--secondary-text-color); }
        #${INJECTED_PANEL_ID} .qt-controls { display: ${hasActiveTask ? 'none' : 'flex'}; flex-direction: column; gap: 10px; }
        #${INJECTED_PANEL_ID} .qt-mode-row { display: flex; gap: 6px; }
        #${INJECTED_PANEL_ID} .qt-mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 8px; background: transparent; color: var(--primary-text-color); font-size: 12px; cursor: pointer; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-mode-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-mode-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-mode-btn ha-icon { --mdc-icon-size: 14px; }
        #${INJECTED_PANEL_ID} .qt-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        #${INJECTED_PANEL_ID} .qt-chips.hidden { display: none; }
        #${INJECTED_PANEL_ID} .qt-chip { padding: 5px 12px; border: 1px solid var(--divider-color); border-radius: 16px; background: transparent; color: var(--primary-text-color); font-size: 12px; cursor: pointer; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-chip:hover { background: var(--primary-color); color: white; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-row { display: flex; gap: 8px; align-items: center; }
        #${INJECTED_PANEL_ID} .qt-row-relative { display: flex; }
        #${INJECTED_PANEL_ID} .qt-row-relative.hidden { display: none; }
        #${INJECTED_PANEL_ID} .qt-row-absolute { display: none; align-items: center; }
        #${INJECTED_PANEL_ID} .qt-row-absolute.visible { display: flex; }
        #${INJECTED_PANEL_ID} .qt-input { flex: 1; padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 15px; min-width: 0; }
        #${INJECTED_PANEL_ID} .qt-input:focus { outline: none; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-input-time { min-width: 90px; text-align: center; }
        #${INJECTED_PANEL_ID} .qt-select { padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 13px; cursor: pointer; min-width: 80px; color-scheme: light dark; }
        #${INJECTED_PANEL_ID} .qt-select option { background: var(--card-background-color, var(--secondary-background-color)); color: var(--primary-text-color); }
        #${INJECTED_PANEL_ID} .qt-service-fields { display: flex; flex-direction: column; gap: 8px; }
        #${INJECTED_PANEL_ID} .qt-service-fields:empty { display: none; }
        #${INJECTED_PANEL_ID} .qt-device-selector { margin-top: 4px; }
        #${INJECTED_PANEL_ID} .qt-device-selector:empty { display: none; }
        #${INJECTED_PANEL_ID} .qt-field-row { display: flex; align-items: center; gap: 8px; }
        #${INJECTED_PANEL_ID} .qt-field-label { font-size: 12px; color: var(--secondary-text-color); min-width: 80px; text-transform: capitalize; }
        #${INJECTED_PANEL_ID} .qt-field-input { flex: 1; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 14px; min-width: 0; }
        #${INJECTED_PANEL_ID} .qt-field-input:focus { outline: none; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-notify { display: flex; gap: 8px; }
        #${INJECTED_PANEL_ID} .qt-notify-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--divider-color); border-radius: 50%; background: transparent; color: var(--secondary-text-color); cursor: pointer; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-notify-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-notify-btn.active { background: var(--primary-color); border-color: var(--primary-color); color: white; }
        #${INJECTED_PANEL_ID} .qt-notify-btn ha-icon { --mdc-icon-size: 18px; }
        #${INJECTED_PANEL_ID} .qt-buttons { display: flex; gap: 8px; flex: 1; }
        #${INJECTED_PANEL_ID} .qt-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        #${INJECTED_PANEL_ID} .qt-btn:hover:not(:disabled) { opacity: 0.9; }
        #${INJECTED_PANEL_ID} .qt-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        #${INJECTED_PANEL_ID} .qt-btn-primary { background: var(--primary-color); color: white; }
        #${INJECTED_PANEL_ID} .qt-btn-cancel { background: var(--error-color, #db4437); color: white; padding: 8px 16px; }
      </style>
      <div class="qt-header">
        <ha-icon icon="mdi:timer-outline"></ha-icon>
        <span>${t('quick_timer')}</span>
        ${history.length > 0 ? `<ha-icon class="qt-history-btn" icon="mdi:history" title="${t('history')}"></ha-icon>` : ''}
        <ha-icon class="qt-chevron" icon="mdi:chevron-down"></ha-icon>
      </div>
      <div class="qt-body">
        <div class="qt-history">
          <div class="qt-history-title">${t('recent')}</div>
          <div class="qt-history-items"></div>
        </div>
        <div class="qt-countdown">
          <ha-icon class="qt-countdown-icon" icon="mdi:timer-sand"></ha-icon>
          <div class="qt-countdown-info">
            <div class="qt-countdown-time">00:00:00</div>
            <div class="qt-countdown-action"></div>
          </div>
          <button class="qt-btn qt-btn-cancel">${t('cancel')}</button>
        </div>
        <div class="qt-controls">
          <div class="qt-mode-row">
            <button class="qt-mode-btn qt-mode-relative ${initialTimeMode === TIME_MODE_RELATIVE ? 'active' : ''}" data-mode="relative">
              <ha-icon icon="mdi:timer-outline"></ha-icon>${t('delay')}
            </button>
            <button class="qt-mode-btn qt-mode-absolute ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'active' : ''}" data-mode="absolute">
              <ha-icon icon="mdi:clock-outline"></ha-icon>${t('time')}
            </button>
          </div>
          <div class="qt-chips ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'hidden' : ''}"></div>
          <div class="qt-row qt-row-relative ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'hidden' : ''}">
            <input type="number" class="qt-input qt-time-input" value="${initialDelay}" min="1" inputmode="numeric">
            <select class="qt-select qt-unit-select">
              <option value="seconds" ${initialUnit === 'seconds' ? 'selected' : ''}>${t('sec')}</option>
              <option value="minutes" ${initialUnit === 'minutes' ? 'selected' : ''}>${t('min')}</option>
              <option value="hours" ${initialUnit === 'hours' ? 'selected' : ''}>${t('hrs')}</option>
            </select>
            <select class="qt-select qt-service-select">${serviceOptionsHtml}</select>
          </div>
          <div class="qt-row qt-row-absolute ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'visible' : ''}">
            <input type="time" class="qt-input qt-input-time qt-at-time-input" value="${initialAtTime}">
            <select class="qt-select qt-service-select-abs">${serviceOptionsHtml}</select>
          </div>
          <div class="qt-service-fields"></div>
          <div class="qt-device-selector"></div>
          <div class="qt-row">
            <div class="qt-notify">
              <button class="qt-notify-btn qt-notify-ha ${initialNotifyHa ? 'active' : ''}" title="${t('ha_notification')}"><ha-icon icon="mdi:bell${initialNotifyHa ? '' : '-off-outline'}"></ha-icon></button>
              <button class="qt-notify-btn qt-notify-mobile ${initialNotifyMobile ? 'active' : ''}" title="${t('mobile_notification')}"><ha-icon icon="mdi:cellphone${initialNotifyMobile ? '-message' : ''}"></ha-icon></button>
            </div>
            <div class="qt-buttons">
              <button class="qt-btn qt-btn-primary qt-btn-start"><ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon>${t('schedule')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire up event handlers
    const header = panel.querySelector('.qt-header');
    const timeInput = panel.querySelector('.qt-time-input');
    const unitSelect = panel.querySelector('.qt-unit-select');
    const serviceSelect = panel.querySelector('.qt-service-select');
    const serviceSelectAbs = panel.querySelector('.qt-service-select-abs');
    const atTimeInput = panel.querySelector('.qt-at-time-input');
    const chipsContainer = panel.querySelector('.qt-chips');
    const startBtn = panel.querySelector('.qt-btn-start');
    const cancelBtn = panel.querySelector('.qt-btn-cancel');
    const notifyHaBtn = panel.querySelector('.qt-notify-ha');
    const notifyMobileBtn = panel.querySelector('.qt-notify-mobile');
    const modeRelativeBtn = panel.querySelector('.qt-mode-relative');
    const modeAbsoluteBtn = panel.querySelector('.qt-mode-absolute');
    const rowRelative = panel.querySelector('.qt-row-relative');
    const rowAbsolute = panel.querySelector('.qt-row-absolute');
    const historyBtn = panel.querySelector('.qt-history-btn');
    const historySection = panel.querySelector('.qt-history');
    const historyItems = panel.querySelector('.qt-history-items');
    const serviceFieldsContainer = panel.querySelector('.qt-service-fields');
    const deviceSelectorContainer = panel.querySelector('.qt-device-selector');

    let notifyHa = initialNotifyHa;
    let notifyMobile = initialNotifyMobile;
    let notifyDeviceIds = [];
    let currentTimeMode = initialTimeMode;
    let currentServiceData = {};  // Stores service field values

    const updateDeviceSelectorVisibility = () => {
      if (deviceSelectorContainer) {
        deviceSelectorContainer.style.display = notifyMobile ? 'block' : 'none';
      }
    };

    if (serviceSelect) serviceSelect.value = initialService;
    if (serviceSelectAbs) serviceSelectAbs.value = initialService;

    // Render device selector for mobile notifications
    if (deviceSelectorContainer) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; margin-top: 4px;';
      label.textContent = t('mobile_notification_devices');
      deviceSelectorContainer.appendChild(label);

      const selector = document.createElement('ha-selector');
      selector.hass = this._getHass();
      selector.selector = { device: { filter: [{ integration: 'mobile_app' }], multiple: true } };
      selector.value = notifyDeviceIds;
      selector.addEventListener('value-changed', (e) => {
        notifyDeviceIds = e.detail.value || [];
        savePrefs();
      });
      deviceSelectorContainer.appendChild(selector);
      updateDeviceSelectorVisibility();
    }

    // Dynamic service fields rendering — uses ha-selector for native HA UX
    const updateServiceFields = (service) => {
      if (!serviceFieldsContainer) return;
      serviceFieldsContainer.innerHTML = '';
      currentServiceData = {};
      const fields = getServiceFields(this._getHass(), service, entityId);
      if (!fields || Object.keys(fields).length === 0) return;

      for (const [key, field] of Object.entries(fields)) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '8px';

        if (field.selector) {
          // Use HA's native ha-selector for correct rendering of all field types
          const selector = document.createElement('ha-selector');
          selector.hass = this._getHass();
          selector.selector = field.selector;
          selector.value = undefined;
          selector.label = field.name || key.replace(/_/g, ' ');
          selector.addEventListener('value-changed', (e) => {
            const val = e.detail.value;
            if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
              delete currentServiceData[key];
            } else {
              currentServiceData[key] = val;
            }
          });
          wrapper.appendChild(selector);
        } else {
          // Fallback: plain input for fields without selector definition
          const row = document.createElement('div');
          row.className = 'qt-field-row';
          const label = document.createElement('span');
          label.className = 'qt-field-label';
          label.textContent = field.name || key.replace(/_/g, ' ');
          row.appendChild(label);
          const input = document.createElement('input');
          input.className = 'qt-field-input';
          input.type = 'text';
          input.placeholder = field.name || field.description || field.example || '';
          input.addEventListener('change', () => {
            const raw = input.value;
            if (raw === '') { delete currentServiceData[key]; return; }
            const num = Number(raw);
            currentServiceData[key] = !isNaN(num) && raw.trim() !== '' ? num : raw;
          });
          row.appendChild(input);
          wrapper.appendChild(row);
        }

        serviceFieldsContainer.appendChild(wrapper);
      }
    };

    // Initialize service fields for the current service
    updateServiceFields(initialService);

    // History chips
    const renderHistory = (entries) => {
      if (!entries?.length || !historyItems) return;
      historyItems.innerHTML = entries.slice(0, 3).map((entry, idx) => {
        const svc = entry.finish_actions?.[0]?.service || entry.service;
        const svcLabel = svc ? getServiceLabel(this._getHass(), svc) : t('action');
        const timeLabel = entry.time_mode === TIME_MODE_ABSOLUTE ? `${t('at')} ${entry.at_time}` : `${t('in')} ${entry.delay}${{ seconds: t('sec'), minutes: t('min'), hours: t('hrs') }[entry.unit] || t('min')}`;
        return `<button class="qt-history-chip" data-index="${idx}">${svcLabel} ${timeLabel}</button>`;
      }).join('');

      historyItems.querySelectorAll('.qt-history-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const i = parseInt(chip.dataset.index, 10);
          const e = entries[i];
          if (!e) return;
          if (e.time_mode === TIME_MODE_ABSOLUTE) {
            currentTimeMode = TIME_MODE_ABSOLUTE;
            if (atTimeInput) atTimeInput.value = e.at_time;
            const absSvc = e.finish_actions?.[0]?.service || e.service || '';
            if (serviceSelectAbs) serviceSelectAbs.value = absSvc;
            updateServiceFields(absSvc);
          } else {
            currentTimeMode = TIME_MODE_RELATIVE;
            if (timeInput) timeInput.value = e.delay;
            if (unitSelect) unitSelect.value = e.unit;
            const relSvc = e.finish_actions?.[0]?.service || e.service || '';
            if (serviceSelect) serviceSelect.value = relSvc;
            updateServiceFields(relSvc);
          }
          // Restore service data from history entry
          const histData = e.finish_actions?.[0]?.data;
          if (histData && typeof histData === 'object') {
            currentServiceData = { ...histData };
            // Update ha-selector values in the rendered fields
            const selectors = serviceFieldsContainer.querySelectorAll('ha-selector');
            const fieldEntries = Object.entries(getServiceFields(this._getHass(), e.finish_actions?.[0]?.service || '', entityId));
            selectors.forEach((sel, idx) => {
              if (idx < fieldEntries.length) {
                const [fKey] = fieldEntries[idx];
                if (histData[fKey] !== undefined) sel.value = histData[fKey];
              }
            });
          }
          updateModeUI();
          if (historySection) historySection.classList.remove('visible');
        });
      });
    };

    renderHistory(history);

    if (historyBtn) {
      historyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        historyBtn.classList.toggle('active');
        historySection.classList.toggle('visible');
      });
    }

    const updateModeUI = () => {
      panel.dataset.timeMode = currentTimeMode;
      modeRelativeBtn.classList.toggle('active', currentTimeMode === TIME_MODE_RELATIVE);
      modeAbsoluteBtn.classList.toggle('active', currentTimeMode === TIME_MODE_ABSOLUTE);
      chipsContainer.classList.toggle('hidden', currentTimeMode === TIME_MODE_ABSOLUTE);
      rowRelative.classList.toggle('hidden', currentTimeMode === TIME_MODE_ABSOLUTE);
      rowAbsolute.classList.toggle('visible', currentTimeMode === TIME_MODE_ABSOLUTE);
      savePrefs();
    };

    const savePrefs = () => {
      const hass = this._getHass();
      if (!hass) return;
      const selectedService = currentTimeMode === TIME_MODE_ABSOLUTE ? serviceSelectAbs?.value : serviceSelect?.value;
      preferencesManager.savePreferences(hass, entityId, {
        last_time_mode: currentTimeMode,
        last_service: selectedService,
        last_delay: parseInt(timeInput?.value, 10) || 15,
        last_unit: unitSelect?.value || 'minutes',
        last_at_time: atTimeInput?.value || getDefaultAbsoluteTime(),
        notify_ha: notifyHa,
        notify_mobile: notifyMobile,
        notify_devices: notifyDeviceIds,
      });
    };

    modeRelativeBtn.addEventListener('click', () => { currentTimeMode = TIME_MODE_RELATIVE; updateModeUI(); });
    modeAbsoluteBtn.addEventListener('click', () => { currentTimeMode = TIME_MODE_ABSOLUTE; updateModeUI(); });

    header.addEventListener('click', () => {
      panel.classList.toggle('expanded');
      const controlsDiv = panel.querySelector('.qt-controls');
      const t = this._getActiveTask(entityId);
      if (!t && controlsDiv) controlsDiv.style.display = panel.classList.contains('expanded') ? 'flex' : 'none';
    });

    const updateNotifyBtn = (btn, active, iconOn, iconOff) => {
      btn.classList.toggle('active', active);
      btn.querySelector('ha-icon').setAttribute('icon', active ? iconOn : iconOff);
    };

    notifyHaBtn.addEventListener('click', () => { notifyHa = !notifyHa; updateNotifyBtn(notifyHaBtn, notifyHa, 'mdi:bell', 'mdi:bell-off-outline'); savePrefs(); });
    notifyMobileBtn.addEventListener('click', () => { notifyMobile = !notifyMobile; updateNotifyBtn(notifyMobileBtn, notifyMobile, 'mdi:cellphone-message', 'mdi:cellphone'); updateDeviceSelectorVisibility(); savePrefs(); });

    const presetConfig = getPresetsFromSensor(hass);
    const unitLabels = { seconds: 's', minutes: 'm', hours: 'h' };

    const updatePresets = () => {
      const currentUnit = unitSelect.value;
      const presetValues = presetConfig[currentUnit] || [5, 15, 30, 60];
      const unitShort = unitLabels[currentUnit] || 'm';
      chipsContainer.innerHTML = presetValues.map(val => `<button class="qt-chip" data-value="${val}">${val}${unitShort}</button>`).join('');
      chipsContainer.querySelectorAll('.qt-chip').forEach(chip => chip.addEventListener('click', () => { timeInput.value = chip.dataset.value; savePrefs(); }));
    };

    const unitDefaults = { seconds: 30, minutes: 15, hours: 1 };
    unitSelect.addEventListener('change', () => { timeInput.value = unitDefaults[unitSelect.value] || 15; updatePresets(); savePrefs(); });
    updatePresets();

    timeInput.addEventListener('input', savePrefs);
    if (serviceSelect) serviceSelect.addEventListener('change', () => { updateServiceFields(serviceSelect.value); savePrefs(); });
    if (serviceSelectAbs) serviceSelectAbs.addEventListener('change', () => { updateServiceFields(serviceSelectAbs.value); savePrefs(); });
    atTimeInput.addEventListener('input', savePrefs);

    // --- Schedule handler using new API ---
    const handleSchedule = async () => {
      const hass = this._getHass();
      if (!hass) return;
      startBtn.disabled = true;
      const origContent = startBtn.innerHTML;
      startBtn.innerHTML = '...';

      try {
        const selectedService = currentTimeMode === TIME_MODE_ABSOLUTE ? serviceSelectAbs.value : serviceSelect.value;

        // Build action arrays for the injected panel (single entity)
        const finish_actions = [];
        if (selectedService) {
          finish_actions.push({ service: selectedService, target: { entity_id: entityId }, data: { ...currentServiceData } });
        } else {
          // Fallback
          const defaultSvc = getDefaultServiceForEntity(hass, entityId);
          if (defaultSvc) finish_actions.push({ service: defaultSvc, target: { entity_id: entityId }, data: { ...currentServiceData } });
        }

        if (finish_actions.length === 0) {
          console.error('[Quick Timer] No service selected');
          startBtn.innerHTML = origContent; startBtn.disabled = false;
          return;
        }

        const entityFriendlyName = hass.states?.[entityId]?.attributes?.friendly_name || entityId;
        const payload = {
          task_id: entityId, // Injected panels use entity_id as task_id for cross-device compatibility
          task_label: entityFriendlyName,
          finish_actions: finish_actions,
          notify_ha: notifyHa,
          notify_mobile: notifyMobile,
          notify_devices: notifyDeviceIds,
          time_mode: currentTimeMode,
        };

        if (currentTimeMode === TIME_MODE_ABSOLUTE) {
          payload.at_time = atTimeInput.value;
        } else {
          payload.delay = parseInt(timeInput.value, 10) || 15;
          payload.unit = unitSelect.value;
        }

        await hass.callService('quick_timer', 'run_action', payload);
        startBtn.innerHTML = '&#10003;';
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => { startBtn.innerHTML = origContent; startBtn.disabled = false; this._updatePanelState(panel, entityId); }, 800);
      } catch (e) {
        console.error('[Quick Timer] Schedule failed:', e);
        startBtn.innerHTML = '&#10007;';
        setTimeout(() => { startBtn.innerHTML = origContent; startBtn.disabled = false; }, 1500);
      }
    };

    startBtn.addEventListener('click', () => handleSchedule());

    cancelBtn.addEventListener('click', async () => {
      const hass = this._getHass();
      if (!hass) return;
      cancelBtn.disabled = true;
      cancelBtn.textContent = '...';
      try {
        await hass.callService('quick_timer', 'cancel_action', { task_id: entityId });
        cancelBtn.textContent = '\u2713';
        if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
        setTimeout(() => { cancelBtn.textContent = t('cancel'); cancelBtn.disabled = false; this._updatePanelState(panel, entityId); }, 800);
      } catch (e) {
        console.error('[Quick Timer] Cancel failed:', e);
        cancelBtn.textContent = '\u2717';
        setTimeout(() => { cancelBtn.textContent = t('cancel'); cancelBtn.disabled = false; }, 1500);
      }
    });

    // Sync preferences from sensor (cross-device)
    if (hass) {
      const sensorPrefs = preferencesManager.getFromSensor(hass, entityId);
      if (sensorPrefs && Object.keys(sensorPrefs).length > 0) {
        if (sensorPrefs.last_time_mode) { currentTimeMode = sensorPrefs.last_time_mode; updateModeUI(); }
        if (sensorPrefs.last_service) {
          if (serviceSelect) serviceSelect.value = sensorPrefs.last_service;
          if (serviceSelectAbs) serviceSelectAbs.value = sensorPrefs.last_service;
        }
        if (sensorPrefs.last_delay && timeInput) timeInput.value = sensorPrefs.last_delay;
        if (sensorPrefs.last_unit && unitSelect) { unitSelect.value = sensorPrefs.last_unit; updatePresets(); }
        if (sensorPrefs.last_at_time && atTimeInput) atTimeInput.value = sensorPrefs.last_at_time;
        if (sensorPrefs.notify_ha !== undefined) { notifyHa = sensorPrefs.notify_ha; updateNotifyBtn(notifyHaBtn, notifyHa, 'mdi:bell', 'mdi:bell-off-outline'); }
        if (sensorPrefs.notify_mobile !== undefined) { notifyMobile = sensorPrefs.notify_mobile; updateNotifyBtn(notifyMobileBtn, notifyMobile, 'mdi:cellphone-message', 'mdi:cellphone'); }
        if (sensorPrefs.notify_devices?.length > 0) {
          notifyDeviceIds = sensorPrefs.notify_devices;
          const selector = deviceSelectorContainer?.querySelector('ha-selector');
          if (selector) selector.value = notifyDeviceIds;
        }
        if (sensorPrefs.history?.length > 0) {
          renderHistory(sensorPrefs.history);
          if (historyBtn) historyBtn.style.display = '';
        }
      }
    }

    target.appendChild(panel);
    if (hasActiveTask) { this._updateCountdownDisplay(panel, task); this._ensurePanelCountdownInterval(panel, entityId); }
  }
}

new QuickTimerDialogInjector();
