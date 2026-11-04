// Small DOM helpers shared by the views.

import { icon, Menu, PALETTES } from '@flow/element/source';

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

const MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
const THEME_KEY = 'flow-theme';
const DEFAULT_THEME = { palette: 'amber', mode: 'auto' };

// Stored as a theme name such as ocean-dark. Older versions also stored plain "auto".
function readTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    // Private browsing can refuse storage, which just means the default.
  }
  const [palette, mode] = (stored ?? '').split('-');
  return PALETTES[palette] && MODES.some(([value]) => value === mode) ? { palette, mode } : DEFAULT_THEME;
}

const themeName = ({ palette, mode }) => `${palette}-${mode}`;

export const currentTheme = () => themeName(readTheme());

/** Chooses the palette and light or dark. `up` opens it upward, for a bottom bar. */
export function themePicker({ onChange, up } = {}) {
  let theme = readTheme();
  const paletteValue = (name) => `palette:${name}`;
  const modeValue = (name) => `mode:${name}`;
  const menu = new Menu({
    up,
    cls: 'theme',
    sections: [
      { label: 'Theme', items: Object.entries(PALETTES).map(([name, { label }]) => ({ value: paletteValue(name), label })) },
      { label: 'Mode', items: MODES.map(([name, label]) => ({ value: modeValue(name), label })) },
    ],
    isChecked: (value) => value === paletteValue(theme.palette) || value === modeValue(theme.mode),
    trigger: () => {
      const { label } = PALETTES[theme.palette];
      const mode = MODES.find(([value]) => value === theme.mode)[1];
      return { label: `Theme: ${label}, ${mode}`, content: [icon('palette'), h('span', { class: 'fl-compact-hide' }, label)] };
    },
    onSelect: (value) => {
      const [kind, name] = value.split(':');
      theme = { ...theme, [kind]: name };
      const chosen = themeName(theme);
      try {
        localStorage.setItem(THEME_KEY, chosen);
      } catch {
        // Private browsing can refuse storage; the theme still applies for this visit.
      }
      document.documentElement.dataset.theme = chosen;
      menu.refresh();
      onChange?.(chosen);
    },
  });
  return menu.root;
}
