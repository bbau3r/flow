import { FlowScript, loadFonts } from './flow-script.js';
import { CONTROLS_CSS } from './controls.js';
import { PAGE_THEME_CSS } from './themes.js';
import { SETTINGS_PANEL_CSS } from './settings-panel.js';
import { THEME_CHOOSER_CSS } from './theme-chooser.js';
import { DIMENSIONS_CSS } from './dimensions-field.js';
import { PAGE_PREVIEW_CSS } from './page-preview.js';

export { FlowScript, loadFonts };
export { addPalette, registerTheme, removePalette, PALETTES } from './themes.js';
export { actionPill, button, icon, iconSwitch, Menu, openModal, pill, pillSep, searchField, tabs, toggleSwitch } from './controls.js';
export { openSettingsPanel } from './settings-panel.js';
export { dimensionsField, pageSizeSetting } from './dimensions-field.js';
export { themeChooser, THEME_MODES } from './theme-chooser.js';
export { parse, layout, DEFAULT_OPTIONS } from '@flow/core';

/** Lets an app use the shared controls and theme colors in its own page. */
export function installControlStyles() {
  const style = document.createElement('style');
  style.textContent = [PAGE_THEME_CSS, CONTROLS_CSS, SETTINGS_PANEL_CSS, THEME_CHOOSER_CSS, DIMENSIONS_CSS, PAGE_PREVIEW_CSS].join('\n');
  document.head.prepend(style);
}

if (!customElements.get('flow-script')) customElements.define('flow-script', FlowScript);
