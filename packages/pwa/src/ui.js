// Small DOM helpers shared by the views.

import { PALETTES, THEME_MODES, themeChooser } from '@flow/element/source';

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

export function timeAgo(when) {
  const minutes = Math.round((Date.now() - when) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const THEME_KEY = 'flow-theme';
const DEFAULT_THEME = { palette: 'sage', mode: 'auto' };

// Palettes that have been renamed, so that a choice saved under the old name still holds.
const RENAMED = { amber: 'sand', ocean: 'sea', tulip: 'lavender', volcano: 'romance' };

/** The chosen theme as { palette, mode }, stored as a name such as sea-dark. Older versions also stored plain "auto". */
export function readTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    // Private browsing can refuse storage, which just means the default.
  }
  const [saved, mode] = (stored ?? '').split('-');
  const palette = RENAMED[saved] ?? saved;
  return PALETTES[palette] && THEME_MODES.some(([value]) => value === mode) ? { palette, mode } : DEFAULT_THEME;
}

const themeName = ({ palette, mode }) => `${palette}-${mode}`;

export const currentTheme = () => themeName(readTheme());

/** Keeps a theme, applies it to the page, and tells open views with a `flow-theme` event. */
export function saveTheme(theme) {
  const chosen = themeName(theme);
  try {
    localStorage.setItem(THEME_KEY, chosen);
  } catch {
    // Private browsing can refuse storage; the theme still applies for this visit.
  }
  showTheme(chosen);
}

function showTheme(chosen) {
  if (document.documentElement.dataset.theme === chosen) return;
  document.documentElement.dataset.theme = chosen;
  window.dispatchEvent(new CustomEvent('flow-theme', { detail: { theme: chosen } }));
}

/**
 * Shows the kept theme again, for when its palette comes or goes with a theme extension. The
 * choice itself is kept, so a palette that comes back is chosen again.
 */
export const refreshTheme = () => showTheme(currentTheme());

/** The palette grid and mode switch, keeping whatever is chosen. */
export const themeControls = () => themeChooser({ value: readTheme(), onChange: saveTheme });
