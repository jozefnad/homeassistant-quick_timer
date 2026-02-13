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
 * @version 2.0.0
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

const CARD_VERSION = '2.0.0';
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
  show_state: true,
  show_badge: true,
  inactive_style: 'dim',
  primary_info: 'name',
  secondary_info: 'timer',
  tap_action: { action: 'toggle-timer' },
  hold_action: { action: 'settings' },
  icon_tap_action: { action: 'settings' },
  notify_ha: false,
  notify_devices: [],
};

const COLOR_OPTIONS = [
  { value: 'state', label: 'By state', color: null },
  { value: 'primary', label: 'Primary', color: 'var(--primary-color)' },
  { value: 'accent', label: 'Accent', color: 'var(--accent-color)' },
  { value: 'disabled', label: 'Disabled', color: 'var(--disabled-color)' },
  { value: 'red', label: 'Red', color: 'var(--red-color, #f44336)' },
  { value: 'pink', label: 'Pink', color: 'var(--pink-color, #e91e63)' },
  { value: 'purple', label: 'Purple', color: 'var(--purple-color, #9c27b0)' },
  { value: 'deep-purple', label: 'Deep Purple', color: 'var(--deep-purple-color, #673ab7)' },
  { value: 'indigo', label: 'Indigo', color: 'var(--indigo-color, #3f51b5)' },
  { value: 'blue', label: 'Blue', color: 'var(--blue-color, #2196f3)' },
  { value: 'light-blue', label: 'Light Blue', color: 'var(--light-blue-color, #03a9f4)' },
  { value: 'cyan', label: 'Cyan', color: 'var(--cyan-color, #00bcd4)' },
  { value: 'teal', label: 'Teal', color: 'var(--teal-color, #009688)' },
  { value: 'green', label: 'Green', color: 'var(--green-color, #4caf50)' },
  { value: 'light-green', label: 'Light Green', color: 'var(--light-green-color, #8bc34a)' },
  { value: 'lime', label: 'Lime', color: 'var(--lime-color, #cddc39)' },
  { value: 'yellow', label: 'Yellow', color: 'var(--yellow-color, #ffeb3b)' },
  { value: 'amber', label: 'Amber', color: 'var(--amber-color, #ffc107)' },
  { value: 'orange', label: 'Orange', color: 'var(--orange-color, #ff9800)' },
  { value: 'deep-orange', label: 'Deep Orange', color: 'var(--deep-orange-color, #ff5722)' },
  { value: 'brown', label: 'Brown', color: 'var(--brown-color, #795548)' },
  { value: 'grey', label: 'Grey', color: 'var(--grey-color, #9e9e9e)' },
  { value: 'blue-grey', label: 'Blue Grey', color: 'var(--blue-grey-color, #607d8b)' },
  { value: 'white', label: 'White', color: 'var(--white-color, #ffffff)' },
];

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
    const info = hass.services?.[d]?.[s];
    if (info?.name) return info.name;
  }
  const name = service.includes('.') ? service.split('.')[1] : service;
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
  // If filtering removed ALL fields but there were unfiltered fields, return all
  // (the entity might not report supported_features correctly)
  if (anyFiltered && Object.keys(filtered).length === 0 && Object.keys(allFields).length > 0) {
    return allFields;
  }
  return filtered;
}

function getServicesForEntity(hass, entityId) {
  if (!hass || !entityId) return [];
  const domain = entityId.split('.')[0];
  const svc = hass.services?.[domain];
  if (!svc) return [];
  return Object.entries(svc).filter(([k]) => !k.startsWith('_')).map(([k, v]) => ({
    value: `${domain}.${k}`,
    label: v.name || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    fields: v.fields || {},
  }));
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
  return short ? ({ seconds: 'sec', minutes: 'min', hours: 'hrs' }[u] || 'min') : ({ seconds: 'Seconds', minutes: 'Minutes', hours: 'Hours' }[u] || 'Minutes');
}

function getRelativeTime(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff >= 86400) return `${Math.floor(diff / 86400)}d ago`;
  if (diff >= 3600) return `${Math.floor(diff / 3600)}h ago`;
  if (diff >= 60) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff)}s ago`;
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
  return `${targets.length} actions`;
}

/**
 * Format service data values for display (e.g., "temperature: 22, brightness: 128").
 */
function formatServiceData(data) {
  if (!data || typeof data !== 'object') return '';
  const entries = Object.entries(data).filter(([k, v]) => k !== 'entity_id' && v !== '' && v !== null && v !== undefined);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ');
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
      _openDropdown: { type: String },
    };
  }

  constructor() {
    super();
    this._expandedSections = { targets: true, appearance: false, interactions: false };
    this._openDropdown = null;
    this._boundClose = this._closeDropdownOutside.bind(this);
  }

  connectedCallback() { super.connectedCallback(); document.addEventListener('click', this._boundClose); }
  disconnectedCallback() { super.disconnectedCallback(); document.removeEventListener('click', this._boundClose); }

  _closeDropdownOutside(e) {
    if (this._openDropdown && !e.composedPath().some(el => el.classList?.contains('custom-select'))) {
      this._openDropdown = null; this.requestUpdate();
    }
  }

  _toggleDropdown(type) { this._openDropdown = this._openDropdown === type ? null : type; this.requestUpdate(); }

  _selectOption(type, value) { this._valueChanged(type, value); this._openDropdown = null; this.requestUpdate(); }

  _getColorPreviewStyle(v, opt) {
    if (v === 'state') return 'background: linear-gradient(135deg, var(--primary-color) 50%, var(--state-icon-color, #9e9e9e) 50%);';
    if (v === 'disabled') return 'background: var(--disabled-color, #9e9e9e);';
    return `background: ${opt?.color || 'var(--primary-color)'};`;
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
      .custom-select { position: relative; width: 100%; }
      .custom-select-trigger { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--input-fill-color, var(--secondary-background-color)); border: 1px solid var(--input-ink-color, var(--divider-color)); border-radius: 4px; cursor: pointer; transition: border-color 0.2s; }
      .custom-select-trigger:hover { border-color: var(--primary-color); }
      .custom-select-trigger .preview-icon { --mdc-icon-size: 24px; color: var(--primary-color); flex-shrink: 0; }
      .custom-select-trigger .preview-color { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--divider-color); flex-shrink: 0; }
      .custom-select-trigger .preview-label { flex: 1; font-size: 14px; color: var(--primary-text-color); }
      .custom-select-trigger .dropdown-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
      .custom-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; max-height: 300px; overflow-y: auto; background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; }
      .custom-select-dropdown.open { display: block; }
      .custom-select-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; transition: background 0.15s; }
      .custom-select-item:hover { background: var(--secondary-background-color); }
      .custom-select-item.selected { background: rgba(var(--rgb-primary-color), 0.1); }
      .custom-select-item ha-icon { --mdc-icon-size: 20px; color: var(--primary-text-color); }
      .custom-select-item .color-dot { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--divider-color); }
      .custom-select-item span { flex: 1; font-size: 14px; }
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
            <span class="target-phase ${isStart ? 'start' : 'finish'}">${isStart ? 'On Start' : 'On Finish'}</span>
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
                    <ha-selector .hass=${this.hass} .selector=${field.selector} .value=${(target.data || {})[key]} .label=${field.name || key}
                      @value-changed=${(e) => this._targetDataChanged(globalIdx, key, e.detail.value)}></ha-selector>
                  ` : html`
                    <ha-textfield .value=${String((target.data || {})[key] ?? '')}
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
                <ha-list-item value="finish">Execute on Finish (when timer ends)</ha-list-item>
                <ha-list-item value="start">Execute on Start (immediately)</ha-list-item>
              </ha-select>
            </div>
          ` : ''}
        </div>
      `;
    };

    return html`
      <!-- Timer Defaults -->
      <div class="editor-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--divider-color);">
        <label>Name (optional)</label>
        <ha-textfield .value=${this._config.name || ''} @input=${(e) => this._valueChanged('name', e.target.value)} placeholder="Auto from targets"></ha-textfield>
      </div>
      <div class="inline-row">
        <div class="editor-row">
          <label>Time Mode</label>
          <ha-select .value=${this._config.default_time_mode || TIME_MODE_RELATIVE} @selected=${(e) => this._valueChanged('default_time_mode', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            <ha-list-item value="relative">Delay (Relative)</ha-list-item>
            <ha-list-item value="absolute">Time (Absolute)</ha-list-item>
          </ha-select>
        </div>
        ${(this._config.default_time_mode || TIME_MODE_RELATIVE) === TIME_MODE_RELATIVE ? html`
          <div class="editor-row">
            <label>Time Unit</label>
            <ha-select .value=${this._config.default_unit || 'minutes'} @selected=${(e) => this._valueChanged('default_unit', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
              <ha-list-item value="seconds">Seconds</ha-list-item>
              <ha-list-item value="minutes">Minutes</ha-list-item>
              <ha-list-item value="hours">Hours</ha-list-item>
            </ha-select>
          </div>
        ` : ''}
      </div>
      ${(this._config.default_time_mode || TIME_MODE_RELATIVE) === TIME_MODE_RELATIVE ? html`
        <div class="editor-row">
          <label>Default Delay</label>
          <ha-textfield type="number" .value=${String(this._config.default_delay || '')} @change=${(e) => { const v = parseInt(e.target.value, 10); this._valueChanged('default_delay', v > 0 ? v : 15); }} min="1" max="9999"></ha-textfield>
        </div>
      ` : html`
        <div class="editor-row">
          <label>Default Time (HH:MM)</label>
          <ha-textfield type="time" .value=${this._config.default_at_time || ''} @input=${(e) => this._valueChanged('default_at_time', e.target.value)} placeholder="e.g. 17:30"></ha-textfield>
        </div>
      `}
      <div class="editor-row">
        <div class="hint">
          Add entity targets that will be scheduled together. Each target can execute <strong>on timer start</strong> (immediately) or <strong>on timer finish</strong> (when countdown ends).
        </div>
        ${targets.map((t, i) => renderTarget(t, i))}
        <button type="button" class="add-target-btn" @click=${() => this._addTarget('finish')}>
          <ha-icon icon="mdi:plus" style="--mdc-icon-size: 18px;"></ha-icon>
          Add Target
        </button>
      </div>
      <div class="inline-row">
        <div class="editor-row switch-row">
          <label>HA Notification</label>
          <ha-switch .checked=${this._config.notify_ha === true} @change=${(e) => this._valueChanged('notify_ha', e.target.checked)}></ha-switch>
        </div>
      </div>
      <div class="editor-row">
        <label>Mobile Notification Devices</label>
        <ha-selector .hass=${this.hass} .selector=${{ device: { filter: [{ integration: 'mobile_app' }], multiple: true } }} .value=${this._config.notify_devices || []} @value-changed=${(e) => this._valueChanged('notify_devices', e.detail.value || [])}></ha-selector>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const selectedColor = this._config.color || 'state';
    const colorOption = COLOR_OPTIONS.find(o => o.value === selectedColor) || COLOR_OPTIONS[0];

    const appearanceSection = html`
      <div class="editor-row">
        <label>Icon</label>
        <ha-icon-picker .hass=${this.hass} .value=${this._config.icon || ''} @value-changed=${(e) => this._valueChanged('icon', e.detail.value)}></ha-icon-picker>
      </div>
      <div class="editor-row">
        <label>Icon Color</label>
        <div class="custom-select" id="color-select">
          <div class="custom-select-trigger" @click=${() => this._toggleDropdown('color')}>
            <div class="preview-color" style="${this._getColorPreviewStyle(selectedColor, colorOption)}"></div>
            <span class="preview-label">${colorOption.label}</span>
            <ha-icon class="dropdown-icon" icon="mdi:chevron-down"></ha-icon>
          </div>
          <div class="custom-select-dropdown ${this._openDropdown === 'color' ? 'open' : ''}">
            ${COLOR_OPTIONS.map(opt => html`
              <div class="custom-select-item ${opt.value === selectedColor ? 'selected' : ''}" @click=${() => this._selectOption('color', opt.value)}>
                <div class="color-dot" style="${this._getColorPreviewStyle(opt.value, opt)}"></div>
                <span>${opt.label}</span>
              </div>
            `)}
          </div>
        </div>
      </div>
      <div class="editor-row">
        <label>Display Mode</label>
        <ha-select .value=${this._config.mode || 'compact'} @selected=${(e) => this._valueChanged('mode', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          <ha-list-item value="compact">Compact (Tile)</ha-list-item>
          <ha-list-item value="full">Full</ha-list-item>
        </ha-select>
      </div>
      <div class="inline-row">
        <div class="editor-row">
          <label>Primary Info</label>
          <ha-select .value=${this._config.primary_info || 'name'} @selected=${(e) => this._valueChanged('primary_info', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${Object.entries(PRIMARY_INFO_OPTIONS).map(([k, v]) => html`<ha-list-item value="${k}">${v}</ha-list-item>`)}
          </ha-select>
        </div>
        <div class="editor-row">
          <label>Secondary Info</label>
          <ha-select .value=${this._config.secondary_info || 'timer'} @selected=${(e) => this._valueChanged('secondary_info', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${Object.entries(SECONDARY_INFO_OPTIONS).map(([k, v]) => html`<ha-list-item value="${k}">${v}</ha-list-item>`)}
          </ha-select>
        </div>
      </div>
      <div class="editor-row">
        <label>Inactive Style</label>
        <ha-select .value=${this._config.inactive_style || 'dim'} @selected=${(e) => this._valueChanged('inactive_style', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          <ha-list-item value="none">None</ha-list-item>
          <ha-list-item value="dim">Dim (opacity)</ha-list-item>
          <ha-list-item value="grayscale">Grayscale</ha-list-item>
        </ha-select>
      </div>
      <div class="inline-row">
        <div class="editor-row"><ha-formfield label="Show State"><ha-switch .checked=${this._config.show_state !== false} @change=${(e) => this._valueChanged('show_state', e.target.checked)}></ha-switch></ha-formfield></div>
        <div class="editor-row"><ha-formfield label="Show Badge"><ha-switch .checked=${this._config.show_badge !== false} @change=${(e) => this._valueChanged('show_badge', e.target.checked)}></ha-switch></ha-formfield></div>
      </div>
    `;

    const interactionsSection = html`
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-tap"></ha-icon>
        <span class="action-label">Tap</span>
        <ha-select .value=${this._config.tap_action?.action || 'toggle-timer'} @selected=${(e) => this._actionChanged('tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([k, v]) => html`<ha-list-item value="${k}">${v}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-tap-hold"></ha-icon>
        <span class="action-label">Hold</span>
        <ha-select .value=${this._config.hold_action?.action || 'settings'} @selected=${(e) => this._actionChanged('hold_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([k, v]) => html`<ha-list-item value="${k}">${v}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:circle-outline"></ha-icon>
        <span class="action-label">Icon Tap</span>
        <ha-select .value=${this._config.icon_tap_action?.action || 'settings'} @selected=${(e) => this._actionChanged('icon_tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([k, v]) => html`<ha-list-item value="${k}">${v}</ha-list-item>`)}
        </ha-select>
      </div>
    `;

    return html`
      <div class="editor-container">
        ${this._renderSection('targets', 'mdi:target', 'Targets & Timer', this._renderTargetsSection())}
        ${this._renderSection('appearance', 'mdi:palette', 'Appearance', appearanceSection)}
        ${this._renderSection('interactions', 'mdi:gesture-tap', 'Interactions', interactionsSection)}
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
    `;
  }

  setConfig(config) {
    if (!(config.targets && config.targets.length > 0) && !config.entity) throw new Error('Please add at least one target');
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
    if (remaining <= 0) { this._isScheduled = false; this._remainingSeconds = 0; }
    this.requestUpdate();
  }

  updated(changedProperties) {
    if (changedProperties.has('hass')) {
      this._checkScheduledTask();
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

    // Primary lookup: by card_id (new architecture)
    if (tasks[cardId]) {
      this._isScheduled = true;
      this._endTimestamp = tasks[cardId].end_timestamp || 0;
      return;
    }

    // Fallback: check entity_id keys (legacy tasks or injected panel tasks)
    const targets = this.config.targets || [];
    if (targets.length > 0) {
      const found = targets.map(t => tasks[t.entity]).filter(Boolean)[0];
      if (found) {
        this._isScheduled = true;
        this._endTimestamp = found.end_timestamp || 0;
        return;
      }
    } else if (this.config.entity && tasks[this.config.entity]) {
      this._isScheduled = true;
      this._endTimestamp = tasks[this.config.entity].end_timestamp || 0;
      return;
    }

    this._isScheduled = false;
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
      const valid = targets.filter(t => t.entity).length;
      return {
        name: `${valid} ${valid === 1 ? 'Entity' : 'Entities'} Scheduled`,
        state: 'group', icon: this.config.icon || 'mdi:timer-outline',
        lastChanged: null, attributes: {},
      };
    }

    // Legacy single entity
    const entity = this.hass?.states?.[this.config.entity];
    if (!entity) return { name: this.config.entity || 'Quick Timer', state: 'unavailable', icon: 'mdi:help-circle', lastChanged: null, attributes: {} };
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
      if (this._isScheduled) return 'var(--warning-color, #ff9800)';
      const info = this._getEntityInfo();
      if (info.state === 'on') return 'var(--state-light-active-color, var(--amber-color, #ffc107))';
      return 'var(--state-icon-color, #9e9e9e)';
    }
    return COLOR_OPTIONS.find(o => o.value === key)?.color || 'var(--primary-color)';
  }

  _getPrimaryInfo() {
    const info = this._getEntityInfo();
    switch (this.config.primary_info) {
      case 'name': return info.name;
      case 'state': return info.state === 'on' ? 'On' : info.state === 'off' ? 'Off' : info.state;
      case 'last-changed': return info.lastChanged ? getRelativeTime(info.lastChanged) : '';
      case 'none': return '';
      default: return info.name;
    }
  }

  _getSecondaryInfo() {
    const targets = this.config.targets || [];
    const finishTargets = targets.filter(t => t.phase !== 'start');
    const label = summarizeActions(this.hass, finishTargets);

    if (this._isScheduled) return html`<span class="highlight">${label || 'Timer'}</span> in ${formatCountdownShort(this._remainingSeconds)}`;

    switch (this.config.secondary_info) {
      case 'timer':
        if (this._timeMode === TIME_MODE_ABSOLUTE) return html`<span class="highlight">${label || 'Timer'}</span> at ${this._atTime}`;
        return html`<span class="highlight">${label || 'Timer'}</span> in ${this._delay} ${getUnitLabel(this._unit, true)}`;
      case 'state': { const info = this._getEntityInfo(); return info.state === 'on' ? 'On' : info.state === 'off' ? 'Off' : info.state; }
      case 'action': return label;
      case 'none': return '';
      default:
        if (this._timeMode === TIME_MODE_ABSOLUTE) return html`<span class="highlight">${label || 'Timer'}</span> at ${this._atTime}`;
        return html`<span class="highlight">${label || 'Timer'}</span> in ${this._delay} ${getUnitLabel(this._unit, true)}`;
    }
  }

  _getInactiveClass() {
    if (this._isScheduled) return '';
    const info = this._getEntityInfo();
    if (info.state === 'on') return '';
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
                   : 'Action';
    if (entry.time_mode === TIME_MODE_ABSOLUTE) return `${svcLabel} at ${entry.at_time}`;
    const u = { seconds: 's', minutes: 'm', hours: 'h' }[entry.unit] || 'm';
    return `${svcLabel} in ${entry.delay}${u}`;
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
              <div class="subtitle">${targets.length > 0 ? `${targets.length} targets configured` : info.state}</div>
            </div>
            ${this._history.length > 0 ? html`
              <ha-icon class="history-toggle ${this._showHistory ? 'active' : ''}" icon="mdi:history"
                @click=${() => { this._showHistory = !this._showHistory; this.requestUpdate(); }} title="History"></ha-icon>
            ` : ''}
            <ha-icon class="settings-close" icon="mdi:close" @click=${this._closeSettings}></ha-icon>
          </div>

          ${this._showHistory && this._history.length > 0 ? html`
            <div class="history-section">
              <div class="history-title">Recent</div>
              <div class="history-items">
                ${this._history.slice(0, 3).map(e => html`<button class="history-chip" @click=${() => this._applyHistoryEntry(e)}>${this._formatHistoryEntry(e)}</button>`)}
              </div>
            </div>
          ` : ''}

          ${targets.length > 0 ? html`
            <div class="target-summary">
              ${targets.map(t => { const dataStr = formatServiceData(t.data); return html`
                <div class="target-summary-item">
                  <ha-icon icon="mdi:target"></ha-icon>
                  <span style="flex:1; font-size: 13px;">${this.hass?.states?.[t.entity]?.attributes?.friendly_name || t.entity}</span>
                  <span class="phase-badge ${t.phase === 'start' ? 'start' : 'finish'}">${t.phase === 'start' ? 'start' : 'finish'}</span>
                  <span style="font-size: 11px; color: var(--secondary-text-color);">${getServiceLabel(this.hass, t.service)}${dataStr ? ` (${dataStr})` : ''}</span>
                </div>
              `; })}
            </div>
          ` : ''}

          <div class="timer-controls">
            <div class="timer-mode-row">
              <button type="button" class="mode-btn ${!isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_RELATIVE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon> Delay
              </button>
              <button type="button" class="mode-btn ${isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_ABSOLUTE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:clock-outline" style="--mdc-icon-size: 16px;"></ha-icon> Time
              </button>
            </div>

            ${!isAbsolute ? html`
              <div class="timer-row">
                <input type="number" class="timer-input" .value=${String(this._delay)} min="1"
                  @input=${(e) => { const v = parseInt(e.target.value, 10); if (v > 0) { this._delay = v; this._saveToCardConfig(); } }}
                  @change=${(e) => { const v = parseInt(e.target.value, 10); this._delay = v > 0 ? v : 1; e.target.value = String(this._delay); this._saveToCardConfig(); }}>
                <select class="timer-select" @change=${(e) => { this._unit = e.target.value; this._saveToCardConfig(); this.requestUpdate(); }}>
                  <option value="seconds" ?selected=${this._unit === 'seconds'}>Seconds</option>
                  <option value="minutes" ?selected=${this._unit === 'minutes'}>Minutes</option>
                  <option value="hours" ?selected=${this._unit === 'hours'}>Hours</option>
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
                @click=${() => { this._notifyHa = !this._notifyHa; this._saveToCardConfig(); this.requestUpdate(); }} title="HA Notification">
                <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
              </button>
              <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}"
                @click=${() => { this._notifyMobile = !this._notifyMobile; this._saveToCardConfig(); this.requestUpdate(); }} title="Mobile Notification">
                <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
              </button>
            </div>
            ${this._notifyMobile ? html`
            <div class="editor-row" style="margin-top: 8px;">
              <label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--secondary-text-color);">Mobile Notification Devices</label>
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
              ${this._loading ? '...' : 'Schedule'}
            </button>
          </div>
        </div>
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
    const finishTargets = targets.filter(t => t.phase !== 'start');
    const displayLabel = summarizeActions(this.hass, finishTargets);

    return html`
      <ha-card class="full" style="--icon-color: ${color};">
        <div class="header">
          <ha-icon icon="${info.icon}"></ha-icon>
          <h2>${info.name || 'Quick Timer'}</h2>
          ${this._history.length > 0 ? html`
            <ha-icon class="history-toggle ${this._showHistory ? 'active' : ''}" icon="mdi:history"
              @click=${() => { this._showHistory = !this._showHistory; this.requestUpdate(); }} title="History"></ha-icon>
          ` : ''}
        </div>

        ${targets.length > 0 ? html`
          <div class="target-summary">
            ${targets.map(t => { const dataStr = formatServiceData(t.data); return html`
              <div class="target-summary-item">
                <ha-icon icon="mdi:target"></ha-icon>
                <span style="flex:1;">${this.hass?.states?.[t.entity]?.attributes?.friendly_name || t.entity}</span>
                <span class="phase-badge ${t.phase === 'start' ? 'start' : 'finish'}">${t.phase === 'start' ? 'start' : 'finish'}</span>
                <span style="font-size: 11px; color: var(--secondary-text-color);">${getServiceLabel(this.hass, t.service)}${dataStr ? ` (${dataStr})` : ''}</span>
              </div>
            `; })}
          </div>
        ` : html`
          <div class="entity-name">${info.name} <span class="entity-state ${info.state}">${info.state}</span></div>
        `}

        ${this._showHistory && this._history.length > 0 ? html`
          <div class="history-section">
            <div class="history-title">Recent</div>
            <div class="history-items">
              ${this._history.slice(0, 3).map(e => html`<button class="history-chip" @click=${() => this._applyHistoryEntry(e)}>${this._formatHistoryEntry(e)}</button>`)}
            </div>
          </div>
        ` : ''}

        ${this._isScheduled ? html`
          <div class="countdown-container">
            <ha-icon class="countdown-icon" icon="mdi:timer-sand"></ha-icon>
            <div class="countdown-info">
              <div class="countdown-label">Countdown to action</div>
              <div class="countdown-time">${formatCountdown(this._remainingSeconds)}</div>
            </div>
            <div class="countdown-action">${displayLabel}</div>
            <button class="countdown-cancel-btn" @click=${() => this._cancelSchedule()} ?disabled=${this._loading}>${this._loading ? '...' : 'Cancel'}</button>
          </div>
        ` : html`
          <div class="timer-controls">
            <div class="timer-mode-row">
              <button type="button" class="mode-btn ${!isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_RELATIVE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon> Delay
              </button>
              <button type="button" class="mode-btn ${isAbsolute ? 'active' : ''}"
                @click=${() => { this._timeMode = TIME_MODE_ABSOLUTE; this._saveToCardConfig(); this.requestUpdate(); }}>
                <ha-icon icon="mdi:clock-outline" style="--mdc-icon-size: 16px;"></ha-icon> Time
              </button>
            </div>
            ${!isAbsolute ? html`
              <div class="timer-row">
                <input type="number" class="timer-input" .value=${String(this._delay)}
                  @input=${(e) => { const v = parseInt(e.target.value, 10); if (v > 0) { this._delay = v; this._saveToCardConfig(); } }}
                  @change=${(e) => { const v = parseInt(e.target.value, 10); this._delay = v > 0 ? v : 1; e.target.value = String(this._delay); this._saveToCardConfig(); }} min="1">
                <select class="timer-select" @change=${(e) => { this._unit = e.target.value; this._saveToCardConfig(); this.requestUpdate(); }}>
                  <option value="seconds" ?selected=${this._unit === 'seconds'}>Seconds</option>
                  <option value="minutes" ?selected=${this._unit === 'minutes'}>Minutes</option>
                  <option value="hours" ?selected=${this._unit === 'hours'}>Hours</option>
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
                @click=${() => { this._notifyHa = !this._notifyHa; this._saveToCardConfig(); this.requestUpdate(); }} title="HA Notification">
                <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
              </button>
              <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}"
                @click=${() => { this._notifyMobile = !this._notifyMobile; this._saveToCardConfig(); this.requestUpdate(); }} title="Mobile Notification">
                <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
              </button>
            </div>
            ${this._notifyMobile ? html`
            <div style="margin-top: 8px;">
              <label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--secondary-text-color);">Mobile Notification Devices</label>
              <ha-selector .hass=${this.hass} .selector=${{ device: { filter: [{ integration: 'mobile_app' }], multiple: true } }} .value=${this._notifyDevices || []} @value-changed=${(e) => { this._notifyDevices = e.detail.value || []; this._saveToCardConfig(); this.requestUpdate(); }}></ha-selector>
            </div>
            ` : ''}
            <div class="timer-buttons">
              <button class="timer-btn timer-btn-primary" @click=${() => { this._saveToCardConfig(); this._startSchedule(); }} ?disabled=${this._loading}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 18px;"></ha-icon>
                ${this._loading ? '...' : 'Schedule'}
              </button>
            </div>
          </div>
        `}
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
  getCardSize() { return 3; }

  connectedCallback() { super.connectedCallback(); this._updateInterval = setInterval(() => this.requestUpdate(), 1000); }
  disconnectedCallback() { super.disconnectedCallback(); if (this._updateInterval) clearInterval(this._updateInterval); }

  updated(changedProperties) {
    if (changedProperties.has('hass')) {
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

    return html`
      <ha-card>
        <div class="header">
          <ha-icon icon="mdi:calendar-clock"></ha-icon>
          <h2>${this.config?.title || 'Quick Timers'}</h2>
          ${entries.length > 0 ? html`<span class="task-count">${entries.length}</span>` : ''}
        </div>
        ${entries.length === 0 ? html`
          <div class="no-tasks"><ha-icon icon="mdi:calendar-check"></ha-icon><div>No active timers</div></div>
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
  documentationURL: 'https://github.com/jozefnad/homeassistant-quick_timer',
});
window.customCards.push({
  type: 'quick-timer-overview-card',
  name: 'Quick Timer Overview',
  description: 'Dashboard card showing all active scheduled tasks.',
  preview: true,
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
        <span>Quick Timer</span>
        ${history.length > 0 ? `<ha-icon class="qt-history-btn" icon="mdi:history" title="History"></ha-icon>` : ''}
        <ha-icon class="qt-chevron" icon="mdi:chevron-down"></ha-icon>
      </div>
      <div class="qt-body">
        <div class="qt-history">
          <div class="qt-history-title">Recent</div>
          <div class="qt-history-items"></div>
        </div>
        <div class="qt-countdown">
          <ha-icon class="qt-countdown-icon" icon="mdi:timer-sand"></ha-icon>
          <div class="qt-countdown-info">
            <div class="qt-countdown-time">00:00:00</div>
            <div class="qt-countdown-action"></div>
          </div>
          <button class="qt-btn qt-btn-cancel">Cancel</button>
        </div>
        <div class="qt-controls">
          <div class="qt-mode-row">
            <button class="qt-mode-btn qt-mode-relative ${initialTimeMode === TIME_MODE_RELATIVE ? 'active' : ''}" data-mode="relative">
              <ha-icon icon="mdi:timer-outline"></ha-icon>Delay
            </button>
            <button class="qt-mode-btn qt-mode-absolute ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'active' : ''}" data-mode="absolute">
              <ha-icon icon="mdi:clock-outline"></ha-icon>Time
            </button>
          </div>
          <div class="qt-chips ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'hidden' : ''}"></div>
          <div class="qt-row qt-row-relative ${initialTimeMode === TIME_MODE_ABSOLUTE ? 'hidden' : ''}">
            <input type="number" class="qt-input qt-time-input" value="${initialDelay}" min="1" inputmode="numeric">
            <select class="qt-select qt-unit-select">
              <option value="seconds" ${initialUnit === 'seconds' ? 'selected' : ''}>Sec</option>
              <option value="minutes" ${initialUnit === 'minutes' ? 'selected' : ''}>Min</option>
              <option value="hours" ${initialUnit === 'hours' ? 'selected' : ''}>Hrs</option>
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
              <button class="qt-notify-btn qt-notify-ha ${initialNotifyHa ? 'active' : ''}" title="HA Notification"><ha-icon icon="mdi:bell${initialNotifyHa ? '' : '-off-outline'}"></ha-icon></button>
              <button class="qt-notify-btn qt-notify-mobile ${initialNotifyMobile ? 'active' : ''}" title="Mobile Notification"><ha-icon icon="mdi:cellphone${initialNotifyMobile ? '-message' : ''}"></ha-icon></button>
            </div>
            <div class="qt-buttons">
              <button class="qt-btn qt-btn-primary qt-btn-start"><ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon>Schedule</button>
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
      label.textContent = 'Mobile Notification Devices';
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
        const svcLabel = svc ? getServiceLabel(null, svc) : 'Action';
        const timeLabel = entry.time_mode === TIME_MODE_ABSOLUTE ? `at ${entry.at_time}` : `in ${entry.delay}${{ seconds: 's', minutes: 'm', hours: 'h' }[entry.unit] || 'm'}`;
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
        setTimeout(() => { cancelBtn.textContent = 'Cancel'; cancelBtn.disabled = false; this._updatePanelState(panel, entityId); }, 800);
      } catch (e) {
        console.error('[Quick Timer] Cancel failed:', e);
        cancelBtn.textContent = '\u2717';
        setTimeout(() => { cancelBtn.textContent = 'Cancel'; cancelBtn.disabled = false; }, 1500);
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
