import { FlowScript, loadFonts } from './flow-script.js';
import { CONTROLS_CSS } from './controls.js';
import { PAGE_THEME_CSS } from './themes.js';
import { SETTINGS_PANEL_CSS } from './settings-panel.js';
import { THEME_CHOOSER_CSS } from './theme-chooser.js';

export { FlowScript, loadFonts };
export { registerTheme, PALETTES } from './themes.js';
export { actionPill, button, icon, iconSwitch, Menu, openModal, pill, pillSep, searchField, tabs } from './controls.js';
export { openSettingsPanel } from './settings-panel.js';
export { dimensionsField } from './dimensions-field.js';
export { themeChooser, THEME_MODES } from './theme-chooser.js';
export { parse, layout, DEFAULT_OPTIONS } from '@flow/core';

/** Lets an app use the shared controls and theme colors in its own page. */
export function installControlStyles() {
  const style = document.createElement('style');
  style.textContent = `${PAGE_THEME_CSS}\n${CONTROLS_CSS}\n${SETTINGS_PANEL_CSS}\n${THEME_CHOOSER_CSS}`;
  document.head.prepend(style);
}

if (!customElements.get('flow-script')) customElements.define('flow-script', FlowScript);
