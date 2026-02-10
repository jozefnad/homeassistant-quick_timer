/**
 * Quick Timer Card v1.0.0
 * A professional Lovelace card for scheduling one-time actions on Home Assistant entities.
 * Features: Advanced interactions, dynamic visuals, intelligent content, modular editor
 * 
 * @version 1.0.0
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

const CARD_VERSION = '1.0.0';

const DEFAULT_CONFIG = {
  entity: '',
  name: '',
  icon: '',
  color: 'state',
  default_delay: 15,
  default_unit: 'minutes',
  default_action: 'off',
  mode: 'compact',
  show_state: true,
  show_badge: true,
  inactive_style: 'dim',
  primary_info: 'name',
  secondary_info: 'timer',
  tap_action: { action: 'toggle-timer' },
  double_tap_action: { action: 'toggle-entity' },
  hold_action: { action: 'settings' },
  icon_tap_action: { action: 'toggle-entity' },
  notify_ha: false,
  notify_mobile: false,
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

const ICON_OPTIONS = [
  { value: '', label: 'From entity' },
  { value: 'mdi:timer-outline', label: 'Timer' },
  { value: 'mdi:timer-sand', label: 'Hourglass' },
  { value: 'mdi:clock-outline', label: 'Clock' },
  { value: 'mdi:clock-start', label: 'Clock Start' },
  { value: 'mdi:clock-end', label: 'Clock End' },
  { value: 'mdi:alarm', label: 'Alarm' },
  { value: 'mdi:bell-outline', label: 'Bell' },
  { value: 'mdi:power', label: 'Power' },
  { value: 'mdi:power-plug', label: 'Power Plug' },
  { value: 'mdi:lightbulb-outline', label: 'Light Bulb' },
  { value: 'mdi:fan', label: 'Fan' },
  { value: 'mdi:toggle-switch-outline', label: 'Switch' },
];

const ACTION_TYPES = {
  'toggle-timer': 'Start/Cancel Timer',
  'toggle-entity': 'Toggle Entity',
  'turn-on': 'Turn On Entity',
  'turn-off': 'Turn Off Entity',
  'settings': 'Open Settings',
  'more-info': 'Show Entity Details',
  'none': 'No Action',
};

// Domain-specific actions for timer
const DOMAIN_ACTIONS = {
  light: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
  ],
  switch: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
  ],
  input_boolean: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
  ],
  fan: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
  ],
  cover: [
    { value: 'open_cover', label: 'Open' },
    { value: 'close_cover', label: 'Close' },
    { value: 'stop_cover', label: 'Stop' },
  ],
  media_player: [
    { value: 'media_play', label: 'Play' },
    { value: 'media_stop', label: 'Stop' },
    { value: 'turn_off', label: 'Turn Off' },
  ],
  vacuum: [
    { value: 'start', label: 'Start' },
    { value: 'return_to_base', label: 'Return Home' },
  ],
  climate: [
    { value: 'turn_off', label: 'Turn Off' },
    { value: 'set_hvac_mode_heat', label: 'Heat' },
    { value: 'set_hvac_mode_cool', label: 'Cool' },
    { value: 'set_hvac_mode_auto', label: 'Auto' },
  ],
  humidifier: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
  ],
  // Default fallback
  default: [
    { value: 'on', label: 'Turn On' },
    { value: 'off', label: 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
  ],
};

const PRIMARY_INFO_OPTIONS = {
  name: 'Name',
  state: 'Entity State',
  'last-changed': 'Last Changed',
  none: 'Hidden',
};

const SECONDARY_INFO_OPTIONS = {
  timer: 'Timer/Countdown',
  state: 'Entity State',
  action: 'Scheduled Action',
  attribute: 'Entity Attribute',
  none: 'Hidden',
};

// ============================================
// Utility Functions
// ============================================

function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCountdownShort(seconds) {
  if (seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBadgeTime(seconds) {
  if (seconds <= 0) return '0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatDelayWithUnit(value, unit) {
  const labels = { seconds: 'sec', minutes: 'min', hours: 'hrs' };
  return `${value} ${labels[unit] || 'min'}`;
}

function getActionLabel(action) {
  for (const domain in DOMAIN_ACTIONS) {
    const domainAction = DOMAIN_ACTIONS[domain].find(a => a.value === action);
    if (domainAction) return domainAction.label;
  }
  const fallbackLabels = { on: 'Turn On', off: 'Turn Off', toggle: 'Toggle' };
  return fallbackLabels[action] || action;
}

function getActionsForDomain(entityId) {
  if (!entityId) return DOMAIN_ACTIONS.default;
  const domain = entityId.split('.')[0];
  return DOMAIN_ACTIONS[domain] || DOMAIN_ACTIONS.default;
}

function getDefaultActionForDomain(entityId) {
  const actions = getActionsForDomain(entityId);
  return actions[0]?.value || 'off';
}

function getUnitLabel(unit, short = false) {
  if (short) {
    const labels = { seconds: 'sec', minutes: 'min', hours: 'hrs' };
    return labels[unit] || 'min';
  }
  const labels = { seconds: 'Seconds', minutes: 'Minutes', hours: 'Hours' };
  return labels[unit] || 'Minutes';
}

function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

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
    this._expandedSections = { entity: true, appearance: false, interactions: false };
    this._openDropdown = null;
    this._boundCloseDropdown = this._closeDropdownOnOutsideClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._boundCloseDropdown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._boundCloseDropdown);
  }

  _closeDropdownOnOutsideClick(e) {
    if (this._openDropdown && !e.composedPath().some(el => el.classList?.contains('custom-select'))) {
      this._openDropdown = null;
      this.requestUpdate();
    }
  }

  _toggleDropdown(type) {
    this._openDropdown = this._openDropdown === type ? null : type;
    this.requestUpdate();
  }

  _selectOption(type, value) {
    this._valueChanged(type, value);
    this._openDropdown = null;
    this.requestUpdate();
  }

  _getColorPreviewStyle(colorValue, colorOption) {
    if (colorValue === 'state') {
      return 'background: linear-gradient(135deg, var(--primary-color) 50%, var(--state-icon-color, #9e9e9e) 50%);';
    }
    if (colorValue === 'disabled') {
      return 'background: var(--disabled-color, #9e9e9e);';
    }
    return `background: ${colorOption?.color || 'var(--primary-color)'};`;
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
      .inline-row { display: flex; gap: 12px; }
      .inline-row > * { flex: 1; }
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
      .action-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--divider-color); }
      .action-row:last-child { border-bottom: none; }
      .action-row .action-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
      .action-row .action-label { flex: 1; font-size: 13px; color: var(--primary-text-color); }
      .action-row ha-select { width: 180px; flex: none; }
    `;
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  _toggleSection(section) {
    this._expandedSections = { ...this._expandedSections, [section]: !this._expandedSections[section] };
    this.requestUpdate();
  }

  _valueChanged(configKey, value) {
    if (!this._config || !this.hass) return;
    const newConfig = { ...this._config, [configKey]: value };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true, composed: true }));
  }

  _actionChanged(actionKey, value) {
    if (!this._config || !this.hass) return;
    const newConfig = { ...this._config, [actionKey]: { action: value } };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true, composed: true }));
  }

  _renderSection(id, icon, title, content) {
    const isExpanded = this._expandedSections[id];
    return html`
      <div class="section">
        <div class="section-header" @click=${() => this._toggleSection(id)}>
          <ha-icon icon="${icon}"></ha-icon>
          <span class="title">${title}</span>
          <ha-icon class="chevron ${isExpanded ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="section-content ${isExpanded ? 'expanded' : ''}">${content}</div>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const entitySelector = { entity: { domain: ['light', 'switch', 'input_boolean', 'fan', 'humidifier', 'climate', 'cover', 'media_player', 'vacuum'] } };

    const entitySection = html`
      <div class="editor-row">
        <label>Entity</label>
        <ha-selector .hass=${this.hass} .selector=${entitySelector} .value=${this._config.entity || ''} .required=${true} @value-changed=${(e) => this._valueChanged('entity', e.detail.value)}></ha-selector>
      </div>
      <div class="editor-row">
        <label>Name (optional)</label>
        <ha-textfield .value=${this._config.name || ''} @input=${(e) => this._valueChanged('name', e.target.value)} placeholder="Auto from entity"></ha-textfield>
      </div>
      <div class="inline-row">
        <div class="editor-row">
          <label>Default Action</label>
          <ha-select .value=${this._config.default_action || getDefaultActionForDomain(this._config.entity)} @selected=${(e) => this._valueChanged('default_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${getActionsForDomain(this._config.entity).map(action => html`<ha-list-item value="${action.value}">${action.label}</ha-list-item>`)}
          </ha-select>
        </div>
        <div class="editor-row">
          <label>Time Unit</label>
          <ha-select .value=${this._config.default_unit || 'minutes'} @selected=${(e) => this._valueChanged('default_unit', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            <ha-list-item value="seconds">Seconds</ha-list-item>
            <ha-list-item value="minutes">Minutes</ha-list-item>
            <ha-list-item value="hours">Hours</ha-list-item>
          </ha-select>
        </div>
      </div>
      <div class="editor-row">
        <label>Default Time</label>
        <ha-textfield type="number" .value=${String(this._config.default_delay || 15)} @input=${(e) => this._valueChanged('default_delay', parseInt(e.target.value, 10) || 15)} min="1" max="9999"></ha-textfield>
      </div>
      <div class="inline-row">
        <div class="editor-row switch-row">
          <label>HA Notification</label>
          <ha-switch .checked=${this._config.notify_ha === true} @change=${(e) => this._valueChanged('notify_ha', e.target.checked)}></ha-switch>
        </div>
        <div class="editor-row switch-row">
          <label>Mobile Notification</label>
          <ha-switch .checked=${this._config.notify_mobile === true} @change=${(e) => this._valueChanged('notify_mobile', e.target.checked)}></ha-switch>
        </div>
      </div>
    `;

    const selectedIcon = this._config.icon || '';
    const selectedColor = this._config.color || 'state';
    const iconOption = ICON_OPTIONS.find(o => o.value === selectedIcon) || ICON_OPTIONS[0];
    const colorOption = COLOR_OPTIONS.find(o => o.value === selectedColor) || COLOR_OPTIONS[0];
    
    const appearanceSection = html`
      <div class="editor-row">
        <label>Icon</label>
        <div class="custom-select" id="icon-select">
          <div class="custom-select-trigger" @click=${() => this._toggleDropdown('icon')}>
            <ha-icon class="preview-icon" icon="${selectedIcon || 'mdi:timer-outline'}"></ha-icon>
            <span class="preview-label">${iconOption.label}</span>
            <ha-icon class="dropdown-icon" icon="mdi:chevron-down"></ha-icon>
          </div>
          <div class="custom-select-dropdown ${this._openDropdown === 'icon' ? 'open' : ''}">
            ${ICON_OPTIONS.map(opt => html`
              <div class="custom-select-item ${opt.value === selectedIcon ? 'selected' : ''}" @click=${() => this._selectOption('icon', opt.value)}>
                <ha-icon icon="${opt.value || 'mdi:timer-outline'}"></ha-icon>
                <span>${opt.label}</span>
              </div>
            `)}
          </div>
        </div>
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
            ${Object.entries(PRIMARY_INFO_OPTIONS).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
          </ha-select>
        </div>
        <div class="editor-row">
          <label>Secondary Info</label>
          <ha-select .value=${this._config.secondary_info || 'timer'} @selected=${(e) => this._valueChanged('secondary_info', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
            ${Object.entries(SECONDARY_INFO_OPTIONS).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
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
          ${Object.entries(ACTION_TYPES).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-double-tap"></ha-icon>
        <span class="action-label">Double Tap</span>
        <ha-select .value=${this._config.double_tap_action?.action || 'toggle-entity'} @selected=${(e) => this._actionChanged('double_tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:gesture-tap-hold"></ha-icon>
        <span class="action-label">Hold</span>
        <ha-select .value=${this._config.hold_action?.action || 'settings'} @selected=${(e) => this._actionChanged('hold_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
        </ha-select>
      </div>
      <div class="action-row">
        <ha-icon class="action-icon" icon="mdi:circle-outline"></ha-icon>
        <span class="action-label">Icon Tap</span>
        <ha-select .value=${this._config.icon_tap_action?.action || 'toggle-entity'} @selected=${(e) => this._actionChanged('icon_tap_action', e.target.value)} @closed=${(e) => e.stopPropagation()} fixedMenuPosition>
          ${Object.entries(ACTION_TYPES).map(([key, label]) => html`<ha-list-item value="${key}">${label}</ha-list-item>`)}
        </ha-select>
      </div>
    `;

    return html`
      <div class="editor-container">
        ${this._renderSection('entity', 'mdi:toggle-switch-outline', 'Entity & Timer', entitySection)}
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
      _action: { type: String },
      _isScheduled: { type: Boolean },
      _remainingSeconds: { type: Number },
      _endTimestamp: { type: Number },
      _loading: { type: Boolean },
      _showSettings: { type: Boolean },
      _notifyHa: { type: Boolean },
      _notifyMobile: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._delay = 15;
    this._unit = 'minutes';
    this._action = 'off';
    this._isScheduled = false;
    this._remainingSeconds = 0;
    this._endTimestamp = 0;
    this._countdownInterval = null;
    this._loading = false;
    this._showSettings = false;
    this._notifyHa = false;
    this._notifyMobile = false;
    this._pressTimer = null;
    this._tapCount = 0;
    this._tapTimer = null;
  }

  static getConfigElement() { return document.createElement('quick-timer-card-editor'); }
  static getStubConfig() { return { ...DEFAULT_CONFIG }; }

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
      .timer-select { padding: 10px 14px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 14px; cursor: pointer; min-width: 100px; }
      .timer-notify { display: flex; gap: 8px; align-items: center; }
      .notify-icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--divider-color); border-radius: 50%; background: transparent; color: var(--secondary-text-color); cursor: pointer; transition: all 0.2s; }
      .notify-icon-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
      .notify-icon-btn.active { background: var(--primary-color); border-color: var(--primary-color); color: white; }
      .notify-icon-btn ha-icon { --mdc-icon-size: 18px; }
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
      .settings-actions { display: flex; gap: 12px; margin-top: 20px; }
      .settings-btn { flex: 1; padding: 14px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .settings-btn-cancel { background: var(--secondary-background-color); color: var(--primary-text-color); }
      .settings-btn-save { background: var(--primary-color); color: white; }
      .settings-btn:hover { opacity: 0.9; }
      .ripple { position: absolute; border-radius: 50%; background: rgba(var(--rgb-primary-color), 0.3); transform: scale(0); animation: ripple 0.5s ease-out; pointer-events: none; }
      @keyframes ripple { to { transform: scale(4); opacity: 0; } }
    `;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('Please define an entity');
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._delay = this.config.default_delay || 15;
    this._unit = this.config.default_unit || 'minutes';
    this._action = this.config.default_action || getDefaultActionForDomain(config.entity);
    this._notifyHa = this.config.notify_ha === true;
    this._notifyMobile = this.config.notify_mobile === true;
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
    if (changedProperties.has('hass')) this._checkScheduledTask();
  }

  _checkScheduledTask() {
    if (!this.hass || !this.config.entity) return;
    const monitor = this.hass.states['sensor.quick_timer_monitor'];
    if (!monitor?.attributes?.active_tasks) { this._isScheduled = false; return; }
    const task = monitor.attributes.active_tasks[this.config.entity];
    if (task) {
      this._isScheduled = true;
      this._endTimestamp = task.end_timestamp || 0;
      this._action = task.original_action || task.action;
    } else {
      this._isScheduled = false;
    }
  }

  _handleCardClick(e) {
    if (e.target.closest('.compact-icon-container')) return;
    this._tapCount++;
    if (this._tapTimer) clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => {
      if (this._tapCount === 1) this._executeAction(this.config.tap_action);
      else if (this._tapCount >= 2) this._executeAction(this.config.double_tap_action);
      this._tapCount = 0;
    }, 250);
  }

  _handleIconClick(e) {
    e.stopPropagation();
    this._executeAction(this.config.icon_tap_action);
  }

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
      case 'toggle-timer': this._isScheduled ? await this._cancelSchedule() : await this._startSchedule(false); break;
      case 'toggle-entity': await this._toggleEntity(); break;
      case 'turn-on': await this._callEntityService('turn_on'); break;
      case 'turn-off': await this._callEntityService('turn_off'); break;
      case 'settings': this._openSettings(); break;
      case 'more-info': this._showMoreInfo(); break;
    }
  }

  async _toggleEntity() {
    if (!this.hass || !this.config.entity) return;
    const domain = this.config.entity.split('.')[0];
    try { await this.hass.callService(domain, 'toggle', { entity_id: this.config.entity }); if (navigator.vibrate) navigator.vibrate(30); } catch (e) { console.error('[Quick Timer] Toggle failed:', e); }
  }

  async _callEntityService(service) {
    if (!this.hass || !this.config.entity) return;
    const domain = this.config.entity.split('.')[0];
    try { await this.hass.callService(domain, service, { entity_id: this.config.entity }); if (navigator.vibrate) navigator.vibrate(30); } catch (e) { console.error(`[Quick Timer] ${service} failed:`, e); }
  }

  _showMoreInfo() {
    const event = new Event('hass-more-info', { bubbles: true, composed: true });
    event.detail = { entityId: this.config.entity };
    this.dispatchEvent(event);
  }

  async _startSchedule(runNow = false) {
    if (!this.hass || !this.config.entity || this._loading) return;
    this._loading = true;
    this.requestUpdate();
    try {
      await this.hass.callService('quick_timer', 'run_action', {
        entity_id: this.config.entity,
        delay: this._delay,
        unit: this._unit,
        action: this._action,
        run_now: runNow,
        notify_ha: this._notifyHa,
        notify_mobile: this._notifyMobile,
      });
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (e) { console.error('[Quick Timer] Schedule failed:', e); }
    finally { this._loading = false; this.requestUpdate(); }
  }

  async _cancelSchedule() {
    if (!this.hass || !this.config.entity || this._loading) return;
    this._loading = true;
    this.requestUpdate();
    try {
      await this.hass.callService('quick_timer', 'cancel_action', { entity_id: this.config.entity });
      this._isScheduled = false;
      this._remainingSeconds = 0;
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
    } catch (e) { console.error('[Quick Timer] Cancel failed:', e); }
    finally { this._loading = false; this.requestUpdate(); }
  }

  _openSettings() { this._showSettings = true; this.requestUpdate(); }
  _closeSettings() { this._showSettings = false; this.requestUpdate(); }

  _saveSettings(e) {
    e.preventDefault();
    const form = e.target;
    this._delay = parseInt(form.delay.value, 10) || 15;
    this._unit = form.unit.value;
    this._action = form.action.value;
    this._showSettings = false;
    this._startSchedule(false);
  }

  _getEntityInfo() {
    const entity = this.hass?.states?.[this.config.entity];
    if (!entity) return { name: this.config.entity, state: 'unavailable', icon: 'mdi:help-circle' };
    return {
      name: this.config.name || entity.attributes?.friendly_name || this.config.entity,
      state: entity.state,
      icon: this.config.icon || entity.attributes?.icon || 'mdi:timer-outline',
      lastChanged: entity.last_changed,
      attributes: entity.attributes,
    };
  }

  _getColor() {
    const colorKey = this.config.color || 'state';
    const info = this._getEntityInfo();
    if (colorKey === 'state') {
      if (this._isScheduled) return 'var(--warning-color, #ff9800)';
      if (info.state === 'on') return 'var(--state-light-active-color, var(--amber-color, #ffc107))';
      return 'var(--state-icon-color, #9e9e9e)';
    }
    const colorOption = COLOR_OPTIONS.find(opt => opt.value === colorKey);
    return colorOption?.color || 'var(--primary-color)';
  }

  _getPrimaryInfo() {
    const info = this._getEntityInfo();
    switch (this.config.primary_info) {
      case 'name': return info.name;
      case 'state': return info.state === 'on' ? 'On' : info.state === 'off' ? 'Off' : info.state;
      case 'last-changed': return getRelativeTime(info.lastChanged);
      case 'none': return '';
      default: return info.name;
    }
  }

  _getSecondaryInfo() {
    const info = this._getEntityInfo();
    if (this._isScheduled) return html`<span class="highlight">${getActionLabel(this._action)}</span> in ${formatCountdownShort(this._remainingSeconds)}`;
    switch (this.config.secondary_info) {
      case 'timer': return html`<span class="highlight">${getActionLabel(this._action)}</span> in ${this._delay} ${getUnitLabel(this._unit, true)}`;
      case 'state': return info.state === 'on' ? 'On' : info.state === 'off' ? 'Off' : info.state;
      case 'action': return getActionLabel(this._action);
      case 'none': return '';
      default: return html`<span class="highlight">${getActionLabel(this._action)}</span> in ${this._delay} ${getUnitLabel(this._unit, true)}`;
    }
  }

  _getInactiveClass() {
    const info = this._getEntityInfo();
    if (this._isScheduled || info.state === 'on') return '';
    const style = this.config.inactive_style || 'dim';
    return style === 'dim' ? 'inactive-dim' : style === 'grayscale' ? 'inactive-grayscale' : '';
  }

  _renderSettingsDialog() {
    if (!this._showSettings) return '';
    const info = this._getEntityInfo();
    const presets = { seconds: [30, 60, 120, 300], minutes: [5, 15, 30, 60], hours: [1, 2, 4, 8] };
    const domainActions = getActionsForDomain(this.config.entity);

    return html`
      <div class="settings-overlay" @click=${(e) => e.target === e.currentTarget && this._closeSettings()}>
        <div class="settings-dialog">
          <div class="settings-header">
            <ha-icon icon="${info.icon}"></ha-icon>
            <div class="title-container">
              <h3>${info.name}</h3>
              <div class="subtitle">${info.state === 'on' ? 'On' : 'Off'}</div>
            </div>
            <ha-icon class="settings-close" icon="mdi:close" @click=${this._closeSettings}></ha-icon>
          </div>
          <form @submit=${this._saveSettings}>
            <div class="timer-controls">
              <div class="timer-chips">
                ${presets[this._unit].map(val => html`
                  <button type="button" class="timer-chip ${this._delay === val ? 'active' : ''}" @click=${() => { this._delay = val; this.requestUpdate(); }}>${val}${getUnitLabel(this._unit, true).charAt(0)}</button>
                `)}
              </div>
              <div class="timer-row">
                <input type="number" name="delay" class="timer-input" .value=${String(this._delay)} min="1">
                <select name="unit" class="timer-select" @change=${(e) => { this._unit = e.target.value; this.requestUpdate(); }}>
                  <option value="seconds" ?selected=${this._unit === 'seconds'}>Seconds</option>
                  <option value="minutes" ?selected=${this._unit === 'minutes'}>Minutes</option>
                  <option value="hours" ?selected=${this._unit === 'hours'}>Hours</option>
                </select>
                <select name="action" class="timer-select">
                  ${domainActions.map(action => html`<option value="${action.value}" ?selected=${this._action === action.value}>${action.label}</option>`)}
                </select>
              </div>
              <div class="timer-notify">
                <button type="button" class="notify-icon-btn ${this._notifyHa ? 'active' : ''}" @click=${() => { this._notifyHa = !this._notifyHa; this.requestUpdate(); }} title="HA Notification">
                  <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
                </button>
                <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}" @click=${() => { this._notifyMobile = !this._notifyMobile; this.requestUpdate(); }} title="Mobile Notification">
                  <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
                </button>
              </div>
            </div>
            <div class="settings-actions">
              <button type="button" class="settings-btn settings-btn-cancel" @click=${this._closeSettings}>Cancel</button>
              <button type="submit" class="settings-btn settings-btn-save">Schedule</button>
            </div>
          </form>
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
    const domainActions = getActionsForDomain(this.config.entity);
    const presets = { seconds: [30, 60, 120, 300], minutes: [5, 15, 30, 60], hours: [1, 2, 4, 8] };

    return html`
      <ha-card class="full" style="--icon-color: ${color};">
        <div class="header">
          <ha-icon icon="${info.icon}"></ha-icon>
          <h2>${this.config.name || 'Quick Timer'}</h2>
        </div>
        <div class="entity-name">${info.name} <span class="entity-state ${info.state}">${info.state}</span></div>

        ${this._isScheduled ? html`
          <div class="countdown-container">
            <ha-icon class="countdown-icon" icon="mdi:timer-sand"></ha-icon>
            <div class="countdown-info">
              <div class="countdown-label">Countdown to action</div>
              <div class="countdown-time">${formatCountdown(this._remainingSeconds)}</div>
            </div>
            <div class="countdown-action">${getActionLabel(this._action)}</div>
            <button class="countdown-cancel-btn" @click=${this._cancelSchedule} ?disabled=${this._loading}>${this._loading ? '...' : 'Cancel'}</button>
          </div>
        ` : html`
          <div class="timer-controls">
            <div class="timer-chips">
              ${presets[this._unit].map(val => html`<button type="button" class="timer-chip ${this._delay === val ? 'active' : ''}" @click=${() => { this._delay = val; this.requestUpdate(); }}>${val}${getUnitLabel(this._unit, true).charAt(0)}</button>`)}
            </div>
            <div class="timer-row">
              <input type="number" class="timer-input" .value=${String(this._delay)} @input=${(e) => this._delay = parseInt(e.target.value, 10) || 15} min="1">
              <select class="timer-select" @change=${(e) => { this._unit = e.target.value; this.requestUpdate(); }}>
                <option value="seconds" ?selected=${this._unit === 'seconds'}>Seconds</option>
                <option value="minutes" ?selected=${this._unit === 'minutes'}>Minutes</option>
                <option value="hours" ?selected=${this._unit === 'hours'}>Hours</option>
              </select>
              <select class="timer-select" @change=${(e) => this._action = e.target.value}>
                ${domainActions.map(action => html`<option value="${action.value}" ?selected=${this._action === action.value}>${action.label}</option>`)}
              </select>
            </div>
            <div class="timer-notify">
              <button type="button" class="notify-icon-btn ${this._notifyHa ? 'active' : ''}" @click=${() => { this._notifyHa = !this._notifyHa; this.requestUpdate(); }} title="HA Notification">
                <ha-icon icon="mdi:bell${this._notifyHa ? '' : '-off-outline'}"></ha-icon>
              </button>
              <button type="button" class="notify-icon-btn ${this._notifyMobile ? 'active' : ''}" @click=${() => { this._notifyMobile = !this._notifyMobile; this.requestUpdate(); }} title="Mobile Notification">
                <ha-icon icon="mdi:cellphone${this._notifyMobile ? '-message' : ''}"></ha-icon>
              </button>
            </div>
            <div class="timer-buttons">
              <button class="timer-btn timer-btn-primary" @click=${() => this._startSchedule(false)} ?disabled=${this._loading}>
                <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 18px;"></ha-icon>
                ${this._loading ? '...' : 'Schedule'}
              </button>
              <button class="timer-btn timer-btn-success" @click=${() => this._startSchedule(true)} ?disabled=${this._loading}>
                <ha-icon icon="mdi:flash" style="--mdc-icon-size: 18px;"></ha-icon>
                ${this._loading ? '...' : 'Run Now'}
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
      const monitor = this.hass?.states['sensor.quick_timer_monitor'];
      this._tasks = monitor?.attributes?.active_tasks || {};
    }
  }

  _getRemainingSeconds(task) {
    if (!task.end_timestamp) return 0;
    return Math.max(0, task.end_timestamp - Date.now() / 1000);
  }

  _getEntityName(entityId) {
    return this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  }

  async _cancelTask(entityId, e) {
    if (!this.hass) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await this.hass.callService('quick_timer', 'cancel_action', { entity_id: entityId });
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
    } catch (e) { console.error('[Quick Timer] Cancel failed:', e); }
    finally { btn.disabled = false; }
  }

  render() {
    if (!this.hass) return html``;
    const taskEntries = Object.entries(this._tasks);

    return html`
      <ha-card>
        <div class="header">
          <ha-icon icon="mdi:calendar-clock"></ha-icon>
          <h2>${this.config?.title || 'Quick Timers'}</h2>
          ${taskEntries.length > 0 ? html`<span class="task-count">${taskEntries.length}</span>` : ''}
        </div>
        ${taskEntries.length === 0 ? html`
          <div class="no-tasks">
            <ha-icon icon="mdi:calendar-check"></ha-icon>
            <div>No active timers</div>
          </div>
        ` : html`
          <div class="task-list">
            ${taskEntries.map(([entityId, task]) => html`
              <div class="task-item">
                <ha-icon class="task-icon" icon="mdi:clock-fast"></ha-icon>
                <div class="task-info">
                  <div class="task-entity">${this._getEntityName(entityId)}</div>
                  <div class="task-details">
                    <span class="task-action">${getActionLabel(task.action)}</span>
                    ${task.run_now ? html`<span>Flash</span>` : ''}
                  </div>
                </div>
                <div class="task-countdown">${formatCountdown(this._getRemainingSeconds(task))}</div>
                <button class="task-cancel" @click=${(e) => this._cancelTask(entityId, e)}><ha-icon icon="mdi:close"></ha-icon></button>
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
  description: 'Professional timer card with advanced interactions, dynamic visuals, and intelligent content.',
  preview: true,
  documentationURL: 'https://github.com/jozefnad/homeassitant-quick_timer',
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

const SUPPORTED_DOMAINS = ['light', 'switch', 'input_boolean', 'fan', 'humidifier', 'climate', 'cover', 'media_player', 'vacuum'];
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
    console.log('[Quick Timer] Dialog Injector v1.0.0 initializing...');
    this._setupObserver();
  }

  _setupObserver() {
    const waitForHA = () => {
      const ha = document.querySelector('home-assistant');
      if (!ha) { 
        setTimeout(waitForHA, 100); 
        return; 
      }
      
      // Observe home-assistant for shadow root changes
      const haObserver = new MutationObserver(() => this._scheduleInjection());
      haObserver.observe(ha, { childList: true, subtree: true, attributes: true });
      this._observers.push(haObserver);
      
      // Also observe shadow root when available
      if (ha.shadowRoot) {
        const shadowObserver = new MutationObserver(() => this._scheduleInjection());
        shadowObserver.observe(ha.shadowRoot, { childList: true, subtree: true });
        this._observers.push(shadowObserver);
      }
      
      // Listen for hass-more-info events
      document.body.addEventListener('hass-more-info', () => {
        this._retryCount = 0;
        this._retryInjection();
      });
      
      // Also listen on ha element
      ha.addEventListener('hass-more-info', () => {
        this._retryCount = 0;
        this._retryInjection();
      });
      
      console.log('[Quick Timer] Dialog observers initialized');
      this._scheduleInjection();
    };
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForHA);
    } else {
      waitForHA();
    }
  }

  _retryInjection() {
    if (this._retryCount >= this._maxRetries) return;
    this._retryCount++;
    
    setTimeout(() => {
      this._tryInject();
      // Keep retrying until we find the target or hit max
      if (!this._lastEntityId && this._retryCount < this._maxRetries) {
        this._retryInjection();
      }
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
    const monitor = hass.states['sensor.quick_timer_monitor'];
    return monitor?.attributes?.active_tasks?.[entityId] || null;
  }

  _findMoreInfoContent() {
    const ha = document.querySelector('home-assistant');
    if (!ha?.shadowRoot) return null;
    
    // Try multiple paths to find the more-info dialog content
    const paths = [
      // Path 1: Standard more-info-dialog
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
      // Path 2: Try finding via more-info-content
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
      // Path 3: Direct dialog content search
      () => {
        const dialog = ha.shadowRoot.querySelector('ha-more-info-dialog');
        if (!dialog) return null;
        const entityId = dialog.entityId;
        if (!entityId) return null;
        // Deep search for content area
        const findContent = (root, depth = 0) => {
          if (depth > 5) return null;
          if (!root) return null;
          
          // Check current root
          const content = root.querySelector?.('.content');
          if (content) return content;
          
          // Check shadow root
          if (root.shadowRoot) {
            const shadowContent = findContent(root.shadowRoot, depth + 1);
            if (shadowContent) return shadowContent;
          }
          
          // Check children
          for (const child of (root.children || [])) {
            const childContent = findContent(child, depth + 1);
            if (childContent) return childContent;
          }
          
          return null;
        };
        
        const content = findContent(dialog);
        return content && entityId ? { target: content, entityId } : null;
      }
    ];
    
    for (const pathFn of paths) {
      try {
        const result = pathFn();
        if (result) return result;
      } catch (e) {
        // Continue to next path
      }
    }
    
    return null;
  }

  _tryInject() {
    if (this._injecting) return;
    this._injecting = true;

    try {
      const result = this._findMoreInfoContent();
      if (!result) { 
        this._cleanup(); 
        return; 
      }
      
      const { target, entityId } = result;
      
      const domain = entityId.split('.')[0];
      if (!SUPPORTED_DOMAINS.includes(domain)) { 
        this._removePanel(target); 
        return; 
      }

      const existingPanel = target.querySelector(`#${INJECTED_PANEL_ID}`);
      if (existingPanel) {
        if (existingPanel.dataset.entityId === entityId) { 
          this._updatePanelState(existingPanel, entityId); 
          return; 
        } else { 
          this._removePanel(target); 
        }
      }

      this._injectPanel(target, entityId);
      this._lastEntityId = entityId;
      console.log(`[Quick Timer] Panel injected for ${entityId}`);
    } finally { 
      this._injecting = false; 
    }
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
    if (actionLabel) actionLabel.textContent = getActionLabel(task.action);
    if (remaining <= 0) {
      if (panel._countdownInterval) { clearInterval(panel._countdownInterval); panel._countdownInterval = null; }
      const entityId = panel.dataset.entityId;
      if (entityId) setTimeout(() => this._updatePanelState(panel, entityId), 500);
    }
  }

  _injectPanel(target, entityId) {
    const task = this._getActiveTask(entityId);
    const hasActiveTask = !!task;
    const domainActions = getActionsForDomain(entityId);
    const actionOptionsHtml = domainActions.map(a => `<option value="${a.value}">${a.label}</option>`).join('');
    
    const panel = document.createElement('div');
    panel.id = INJECTED_PANEL_ID;
    panel.dataset.entityId = entityId;
    if (hasActiveTask) panel.classList.add('expanded');
    
    panel.innerHTML = `
      <style>
        #${INJECTED_PANEL_ID} { border-top: 1px solid var(--divider-color); margin-top: 12px; }
        #${INJECTED_PANEL_ID} .qt-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; cursor: pointer; user-select: none; transition: background 0.2s; }
        #${INJECTED_PANEL_ID} .qt-header:hover { background: var(--secondary-background-color); }
        #${INJECTED_PANEL_ID} .qt-header ha-icon { color: var(--primary-color); --mdc-icon-size: 20px; }
        #${INJECTED_PANEL_ID} .qt-header span { flex: 1; font-weight: 500; font-size: 14px; }
        #${INJECTED_PANEL_ID} .qt-header .qt-chevron { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.2s; }
        #${INJECTED_PANEL_ID}.expanded .qt-header .qt-chevron { transform: rotate(180deg); }
        #${INJECTED_PANEL_ID} .qt-body { display: none; padding: 0 16px 16px; }
        #${INJECTED_PANEL_ID}.expanded .qt-body { display: block; }
        #${INJECTED_PANEL_ID} .qt-countdown { display: ${hasActiveTask ? 'flex' : 'none'}; align-items: center; gap: 12px; padding: 10px; background: rgba(var(--rgb-primary-color), 0.1); border-radius: 10px; margin-bottom: 12px; }
        #${INJECTED_PANEL_ID} .qt-countdown-icon { --mdc-icon-size: 24px; color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-countdown-info { flex: 1; }
        #${INJECTED_PANEL_ID} .qt-countdown-time { font-family: 'Roboto Mono', monospace; font-size: 18px; font-weight: 600; color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-countdown-action { font-size: 11px; color: var(--secondary-text-color); }
        #${INJECTED_PANEL_ID} .qt-controls { display: ${hasActiveTask ? 'none' : 'flex'}; flex-direction: column; gap: 10px; }
        #${INJECTED_PANEL_ID} .qt-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        #${INJECTED_PANEL_ID} .qt-chip { padding: 5px 12px; border: 1px solid var(--divider-color); border-radius: 16px; background: transparent; color: var(--primary-text-color); font-size: 12px; cursor: pointer; transition: all 0.2s; }
        #${INJECTED_PANEL_ID} .qt-chip:hover { background: var(--primary-color); color: white; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-row { display: flex; gap: 8px; align-items: center; }
        #${INJECTED_PANEL_ID} .qt-input { flex: 1; padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 15px; min-width: 0; }
        #${INJECTED_PANEL_ID} .qt-input:focus { outline: none; border-color: var(--primary-color); }
        #${INJECTED_PANEL_ID} .qt-select { padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 10px; background: var(--input-fill-color, var(--secondary-background-color)); color: var(--primary-text-color); font-size: 13px; cursor: pointer; min-width: 80px; }
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
        #${INJECTED_PANEL_ID} .qt-btn-success { background: var(--success-color, #4caf50); color: white; }
        #${INJECTED_PANEL_ID} .qt-btn-cancel { background: var(--error-color, #db4437); color: white; padding: 8px 16px; }
      </style>
      <div class="qt-header">
        <ha-icon icon="mdi:timer-outline"></ha-icon>
        <span>Quick Timer</span>
        <ha-icon class="qt-chevron" icon="mdi:chevron-down"></ha-icon>
      </div>
      <div class="qt-body">
        <div class="qt-countdown">
          <ha-icon class="qt-countdown-icon" icon="mdi:timer-sand"></ha-icon>
          <div class="qt-countdown-info">
            <div class="qt-countdown-time">00:00:00</div>
            <div class="qt-countdown-action"></div>
          </div>
          <button class="qt-btn qt-btn-cancel">Cancel</button>
        </div>
        <div class="qt-controls">
          <div class="qt-chips"></div>
          <div class="qt-row">
            <input type="number" class="qt-input qt-time-input" value="15" min="1" inputmode="numeric">
            <select class="qt-select qt-unit-select">
              <option value="seconds">Sec</option>
              <option value="minutes" selected>Min</option>
              <option value="hours">Hrs</option>
            </select>
            <select class="qt-select qt-action-select">${actionOptionsHtml}</select>
          </div>
          <div class="qt-row">
            <div class="qt-notify">
              <button class="qt-notify-btn qt-notify-ha" title="HA Notification"><ha-icon icon="mdi:bell-off-outline"></ha-icon></button>
              <button class="qt-notify-btn qt-notify-mobile" title="Mobile Notification"><ha-icon icon="mdi:cellphone"></ha-icon></button>
            </div>
            <div class="qt-buttons">
              <button class="qt-btn qt-btn-primary qt-btn-start"><ha-icon icon="mdi:timer-outline" style="--mdc-icon-size: 16px;"></ha-icon>Schedule</button>
              <button class="qt-btn qt-btn-success qt-btn-flash"><ha-icon icon="mdi:flash" style="--mdc-icon-size: 16px;"></ha-icon>Now</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const header = panel.querySelector('.qt-header');
    const timeInput = panel.querySelector('.qt-time-input');
    const unitSelect = panel.querySelector('.qt-unit-select');
    const actionSelect = panel.querySelector('.qt-action-select');
    const chipsContainer = panel.querySelector('.qt-chips');
    const startBtn = panel.querySelector('.qt-btn-start');
    const flashBtn = panel.querySelector('.qt-btn-flash');
    const cancelBtn = panel.querySelector('.qt-btn-cancel');
    const notifyHaBtn = panel.querySelector('.qt-notify-ha');
    const notifyMobileBtn = panel.querySelector('.qt-notify-mobile');

    let notifyHa = false, notifyMobile = false;

    header.addEventListener('click', () => {
      panel.classList.toggle('expanded');
      const controlsDiv = panel.querySelector('.qt-controls');
      const task = this._getActiveTask(entityId);
      if (!task && controlsDiv) controlsDiv.style.display = panel.classList.contains('expanded') ? 'flex' : 'none';
    });

    const updateNotifyBtn = (btn, active, iconOn, iconOff) => {
      btn.classList.toggle('active', active);
      btn.querySelector('ha-icon').setAttribute('icon', active ? iconOn : iconOff);
    };

    notifyHaBtn.addEventListener('click', () => { notifyHa = !notifyHa; updateNotifyBtn(notifyHaBtn, notifyHa, 'mdi:bell', 'mdi:bell-off-outline'); });
    notifyMobileBtn.addEventListener('click', () => { notifyMobile = !notifyMobile; updateNotifyBtn(notifyMobileBtn, notifyMobile, 'mdi:cellphone-message', 'mdi:cellphone'); });

    const presetConfig = { seconds: [30, 60, 120, 300], minutes: [5, 15, 30, 60], hours: [1, 2, 4, 8] };
    const unitLabels = { seconds: 's', minutes: 'm', hours: 'h' };

    const updatePresets = () => {
      const currentUnit = unitSelect.value;
      const presets = presetConfig[currentUnit] || [5, 15, 30, 60];
      const unitShort = unitLabels[currentUnit] || 'm';
      chipsContainer.innerHTML = presets.map(val => `<button class="qt-chip" data-value="${val}">${val}${unitShort}</button>`).join('');
      chipsContainer.querySelectorAll('.qt-chip').forEach(chip => chip.addEventListener('click', () => timeInput.value = chip.dataset.value));
    };

    const unitDefaults = { seconds: 30, minutes: 15, hours: 1 };
    unitSelect.addEventListener('change', () => { timeInput.value = unitDefaults[unitSelect.value] || 15; updatePresets(); });
    updatePresets();

    const handleSchedule = async (runNow) => {
      const hass = this._getHass();
      if (!hass) return;
      const btn = runNow ? flashBtn : startBtn;
      const delay = parseInt(timeInput.value, 10) || 15;
      btn.disabled = true;
      const origContent = btn.innerHTML;
      btn.innerHTML = '...';
      try {
        await hass.callService('quick_timer', 'run_action', { entity_id: entityId, delay, unit: unitSelect.value, action: actionSelect.value, notify_ha: notifyHa, notify_mobile: notifyMobile, run_now: runNow });
        btn.innerHTML = '✓';
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => { btn.innerHTML = origContent; btn.disabled = false; this._updatePanelState(panel, entityId); }, 800);
      } catch (e) {
        console.error('[Quick Timer] Schedule failed:', e);
        btn.innerHTML = '✗';
        setTimeout(() => { btn.innerHTML = origContent; btn.disabled = false; }, 1500);
      }
    };

    startBtn.addEventListener('click', () => handleSchedule(false));
    flashBtn.addEventListener('click', () => handleSchedule(true));

    cancelBtn.addEventListener('click', async () => {
      const hass = this._getHass();
      if (!hass) return;
      cancelBtn.disabled = true;
      cancelBtn.textContent = '...';
      try {
        await hass.callService('quick_timer', 'cancel_action', { entity_id: entityId });
        cancelBtn.textContent = '✓';
        if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
        setTimeout(() => { cancelBtn.textContent = 'Cancel'; cancelBtn.disabled = false; this._updatePanelState(panel, entityId); }, 800);
      } catch (e) {
        console.error('[Quick Timer] Cancel failed:', e);
        cancelBtn.textContent = '✗';
        setTimeout(() => { cancelBtn.textContent = 'Cancel'; cancelBtn.disabled = false; }, 1500);
      }
    });

    target.appendChild(panel);
    console.log(`[Quick Timer] Panel injected for ${entityId}`);
    if (hasActiveTask) { this._updateCountdownDisplay(panel, task); this._ensurePanelCountdownInterval(panel, entityId); }
  }
}

new QuickTimerDialogInjector();
