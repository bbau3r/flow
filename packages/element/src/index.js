import { FlowScript, loadFonts } from './flow-script.js';
import { CONTROLS_CSS } from './controls.js';
import { PAGE_THEME_CSS } from './themes.js';

export { FlowScript, loadFonts };
export { registerTheme, PALETTES } from './themes.js';
export { actionPill, button, icon, Menu, openModal, pill, pillSep, tabs } from './controls.js';
export { parse, layout, DEFAULT_OPTIONS } from '@flow/core';

/** Lets an app use the shared controls and theme colors in its own page. */
export function installControlStyles() {
  const style = document.createElement('style');
  style.textContent = `${PAGE_THEME_CSS}\n${CONTROLS_CSS}`;
  document.head.prepend(style);
}

if (!customElements.get('flow-script')) customElements.define('flow-script', FlowScript);
