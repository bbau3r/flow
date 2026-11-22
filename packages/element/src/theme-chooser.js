// Choosing a theme: Auto, Light or Dark, then a palette from a grid of small previews, each
// drawn in that palette's own colors for the chosen mode. Shared by the Document menu's Theme
// card and an app's settings. It only reports the choice; keeping it is up to the app.

import { tabs, token } from './controls.js';
import { PALETTES } from './themes.js';

export const THEME_MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
const MODE_ICONS = { auto: 'contrast', light: 'sun', dark: 'moon' };

const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
};

function radio(label, checked, onPick) {
  const node = el('button', '');
  node.type = 'button';
  node.setAttribute('role', 'radio');
  node.setAttribute('aria-checked', String(checked));
  node.addEventListener('click', onPick);
  if (label) node.setAttribute('aria-label', label);
  return node;
}

// Arrow keys move the choice within a group, as with radio buttons.
function arrowKeys(group) {
  group.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const options = [...group.querySelectorAll('[role="radio"]')];
    const index = options.indexOf(group.getRootNode().activeElement);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = options[(index + step + options.length) % options.length];
    next.focus();
    next.click();
  });
}

/** `value` is { palette, mode }; `onChange` gets the new one. Returns { root, mode, palettes }. */
export function themeChooser({ value, onChange }) {
  let theme = { ...value };
  // The same tabs as Write, Outline and Read, as a dropdown when their labels don't fit.
  const modes = tabs({
    label: 'Mode',
    fit: true,
    attrs: { class: 'fl-responsive fl-theme-modes' },
    onSelect: (label) => choose({ mode: THEME_MODES.find(([, name]) => name === label)[0] }),
  }, THEME_MODES.map(([name, label]) => ({ label, icon: MODE_ICONS[name], selected: theme.mode === name })));
  const grid = el('div', 'fl-theme-grid');
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Palette');
  arrowKeys(grid);

  const dark = () => theme.mode === 'dark' || (theme.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);

  const choose = (change) => {
    theme = { ...theme, ...change };
    draw();
    onChange?.({ ...theme });
  };

  // The swatches show each palette in the mode chosen.
  function draw() {
    const shade = dark() ? 'dark' : 'light';
    grid.replaceChildren(...Object.entries(PALETTES).map(([name, palette]) => {
      const colors = palette[shade];
      const chosen = theme.palette === name;
      const node = radio(palette.label, chosen, () => choose({ palette: name }));
      node.className = 'fl-theme-swatch';
      node.tabIndex = chosen ? 0 : -1;
      node.dataset.palette = name;
      // A pill in the palette's own colors: its primary and secondary as two dots, then a pill
      // of tabs with the current one in primary.
      const dot = (color) => {
        const node = el('span', 'fl-theme-dot');
        node.style.background = color;
        return node;
      };
      const tab = (color) => {
        const node = el('span', 'fl-theme-tab');
        node.style.background = color;
        return node;
      };
      const tabsPreview = el('span', 'fl-theme-tabs', tab(colors.accent), tab(colors.paper));
      tabsPreview.style.background = `color-mix(in srgb, ${colors.accent} 18%, ${colors['ribbon-bg']})`;
      tabsPreview.style.borderColor = `color-mix(in srgb, ${colors.accent} 35%, ${colors.rule})`;
      const preview = el('span', 'fl-theme-preview', dot(colors.accent), dot(colors.secondary), tabsPreview);
      preview.style.background = colors['ribbon-bg'];
      preview.style.borderColor = colors.rule;
      node.append(preview, el('span', 'fl-theme-name', palette.label));
      return node;
    }));
  }
  draw();
  const root = el('div', 'fl-theme-chooser', modes, grid);
  return { root, modes, grid };
}

export const THEME_CHOOSER_CSS = `
.fl-theme-chooser { display: flex; flex-direction: column; gap: 14px; }
.fl-theme-modes .fl-wide-only > .fl-tabs { display: flex; box-shadow: none; }
.fl-theme-modes .fl-wide-only .fl-tab { flex: 1; justify-content: center; padding-inline: 10px; }
.fl-theme-modes .fl-compact-only > .fl-tabs { box-shadow: none; }
.fl-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
.fl-theme-swatch {
  appearance: none; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px;
  background: transparent; color: inherit; border: 2px solid transparent; border-radius: 10px;
  font: inherit; font-size: 13px; cursor: pointer;
}
.fl-theme-swatch:hover { background: ${token('button-hover-bg')}; }
.fl-theme-swatch:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: 1px; }
.fl-theme-swatch[aria-checked="true"] { border-color: var(--flow-accent); font-weight: 600; }
.fl-theme-preview {
  display: flex; align-items: center; gap: 3px; width: 100%; padding: 4px;
  border: 1px solid; border-radius: 999px;
}
.fl-theme-dot { flex: none; width: 12px; height: 12px; border-radius: 50%; }
.fl-theme-tabs { flex: 1; display: flex; gap: 3px; min-width: 0; margin-left: 2px; padding: 3px; border: 1px solid; border-radius: 999px; }
.fl-theme-tab { flex: 1; height: 6px; border-radius: 999px; }
`;
