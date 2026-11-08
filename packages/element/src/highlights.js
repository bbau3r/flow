// Highlights for reading: each is a set of search terms, separated by commas and matched as
// whole words without regard to case, painted in its own color wherever it appears in the Read tab. They're
// drawn with the CSS Custom Highlight API, so the pages themselves are never changed. The
// action center shows one dot per highlight, which turns it off and on, beside a button that
// opens the Highlight Manager to add, change and remove them.

import { button, icon, openModal, pill, pillSep } from './controls.js';

/** Colors new highlights take in turn, like a pack of highlighter pens. */
export const HIGHLIGHT_COLORS = ['#ffe066', '#8ce99a', '#74c0fc', '#faa2c1', '#ffc078', '#b197fc'];

const HEX = /^#[0-9a-f]{6}$/i;

/** The terms in a comma-separated search, trimmed, with blanks left out. */
export const splitTerms = (text) => String(text ?? '').split(',').map((term) => term.trim()).filter(Boolean);

/** A list of { terms, color, enabled }, with anything missing or malformed set right. */
export function normalizeHighlights(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && splitTerms(item.terms).length)
    .map((item, i) => ({
      terms: String(item.terms).trim(),
      color: HEX.test(item.color) ? item.color.toLowerCase() : HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length],
      enabled: item.enabled !== false,
    }));
}

// The first color no other row has, or the next in turn once every one is taken.
const nextColor = (used) => HIGHLIGHT_COLORS.find((color) => !used.includes(color)) ?? HIGHLIGHT_COLORS[used.length % HIGHLIGHT_COLORS.length];

// Dark text on a light highlight and light text on a dark one, whatever the theme's ink.
function inkFor(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? '#111' : '#fff';
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Each piece of text that reads as one run: a cell of a page, a line of the flow view, or the
// whole of the Fountain source. Comment bubbles aren't part of the script, so they're skipped.
function textBlocks(root) {
  if (root.matches('.fl-source')) return [root];
  return root.querySelectorAll('.fl-cell, .fl-line');
}

function textNodesIn(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement.closest('.fl-bubble') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return nodes;
}

// Where each term appears in the blocks, as ranges, even when bold or italic splits the text
// it matches across several nodes.
function findRanges(blocks, terms) {
  // Whole words only, so IAN finds Ian but not Brian: no letter or digit may touch either end.
  // Longer terms come first, so that "Anna Lee" wins over "Anna" where both would match.
  const alternatives = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
  const ranges = [];
  for (const block of blocks) {
    const nodes = textNodesIn(block);
    if (!nodes.length) continue;
    const starts = [];
    let text = '';
    for (const node of nodes) {
      starts.push(text.length);
      text += node.data;
    }
    const locate = (offset, end) => {
      let i = starts.length - 1;
      // An end that falls on a boundary belongs to the node before it.
      while (i > 0 && (end ? starts[i] >= offset : starts[i] > offset)) i -= 1;
      return [nodes[i], offset - starts[i]];
    };
    for (const match of text.matchAll(pattern)) {
      const range = new Range();
      range.setStart(...locate(match.index, false));
      range.setEnd(...locate(match.index + match[0].length, true));
      ranges.push(range);
    }
  }
  return ranges;
}

let painters = 0;

/**
 * Paints highlights into whatever `paint(root, highlights)` is given, replacing what it
 * painted before. The colors go in a stylesheet of its own in `shadow`, since highlights are
 * named for the whole document but styled where their text lives.
 */
export function createHighlightPainter(shadow) {
  const prefix = `flow-highlight-${(painters += 1)}`;
  const style = document.createElement('style');
  shadow.append(style);
  let names = [];
  const supported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

  const clear = () => {
    for (const name of names) CSS.highlights.delete(name);
    names = [];
    style.textContent = '';
  };

  return {
    clear() {
      if (supported) clear();
    },
    paint(root, highlights) {
      if (!supported) return;
      clear();
      if (!root) return;
      const blocks = textBlocks(root);
      const rules = [];
      highlights.forEach((item, i) => {
        if (!item.enabled) return;
        const name = `${prefix}-${i}`;
        const highlight = new Highlight(...findRanges(blocks, splitTerms(item.terms)));
        // Where two overlap, the one higher in the list shows.
        highlight.priority = highlights.length - i;
        CSS.highlights.set(name, highlight);
        names.push(name);
        rules.push(`::highlight(${name}) { background-color: ${item.color}; color: ${inkFor(item.color)}; }`);
      });
      style.textContent = rules.join('\n');
    },
  };
}

/**
 * The Read tab's commands: the Highlight Manager's button, then a dot for each highlight that
 * turns it off and on. `update(highlights)` redraws the dots.
 */
export function createHighlightTools({ open, toggle }) {
  const manager = button({
    label: 'Highlight Manager',
    title: 'Highlight Manager: color words and names as you read',
    icon: 'highlighter',
    iconOnly: true,
    onClick: open,
  });
  const sep = pillSep();
  const dots = document.createElement('div');
  dots.className = 'fl-hl-dots';
  const root = pill({ label: 'Highlights', cls: 'fl-hl-tools' }, manager, sep, dots);

  return {
    root,
    update(highlights) {
      // A dot turned off or on from the keyboard keeps the focus once it's redrawn.
      const focused = [...dots.children].indexOf(root.getRootNode().activeElement);
      queueMicrotask(() => { if (focused >= 0) dots.children[focused]?.focus(); });
      sep.hidden = !highlights.length;
      dots.replaceChildren(...highlights.map((item, i) => {
        const terms = splitTerms(item.terms).join(', ');
        const dot = button({
          label: `Highlight ${terms}`,
          title: `${terms}: ${item.enabled ? 'on, click to hide' : 'off, click to show'}`,
          iconOnly: true,
          toggle: true,
          cls: 'fl-hl-dot',
          onClick: () => toggle(i),
        });
        dot.setAttribute('aria-pressed', String(item.enabled));
        const swatch = document.createElement('span');
        swatch.className = 'fl-hl-swatch';
        swatch.style.setProperty('--fl-hl-color', item.color);
        dot.append(swatch);
        return dot;
      }));
    },
  };
}

/**
 * The Highlight Manager: a row per highlight, with its search terms, its color and a button
 * to remove it, then a + to add another. Only OK keeps the changes, which go to `onSave`.
 */
export function openHighlightDialog(parent, { highlights, onSave, onClose }) {
  const rows = document.createElement('div');
  rows.className = 'fl-hl-rows';

  const addRow = (item = {}) => {
    const row = document.createElement('div');
    row.className = 'fl-hl-row';
    row.dataset.enabled = String(item.enabled !== false);

    const terms = document.createElement('input');
    terms.type = 'text';
    terms.className = 'fl-hl-terms';
    terms.value = item.terms ?? '';
    terms.placeholder = 'Search term, or several with commas';
    terms.setAttribute('aria-label', 'Search terms');
    terms.autocomplete = 'off';
    terms.spellcheck = false;

    const color = document.createElement('button');
    color.type = 'button';
    color.className = 'fl-hl-color';
    color.setAttribute('aria-label', 'Highlight color');
    color.setAttribute('aria-haspopup', 'dialog');
    color.setAttribute('aria-expanded', 'false');
    const setColor = (hex) => {
      color.dataset.color = hex;
      color.style.setProperty('--fl-hl-color', hex);
      color.title = `Highlight color: ${hex}`;
    };
    setColor(item.color ?? nextColor([...rows.querySelectorAll('.fl-hl-color')].map((swatch) => swatch.dataset.color)));
    color.addEventListener('click', (event) => picker.toggle(color, color.dataset.color, setColor, event.detail === 0));

    const remove = button({
      label: 'Remove highlight',
      icon: 'close',
      iconOnly: true,
      cls: 'fl-hl-remove',
      onClick: () => {
        picker.close();
        const next = row.nextElementSibling ?? row.previousElementSibling;
        row.remove();
        (next?.querySelector('.fl-hl-terms') ?? add).focus();
      },
    });

    row.append(terms, color, remove);
    rows.append(row);
    return terms;
  };

  // Made once the dialog is, since it sits in it. Rows only reach it when clicked.
  let picker = null;
  for (const item of highlights) addRow(item);
  const first = highlights.length ? null : addRow();

  const add = button({
    label: 'Add highlight',
    icon: 'plus',
    iconOnly: true,
    cls: 'fl-btn-outline fl-hl-add',
    onClick: () => {
      const terms = addRow();
      terms.focus();
      terms.scrollIntoView({ block: 'nearest' });
    },
  });
  const addRowNode = document.createElement('div');
  addRowNode.className = 'fl-hl-add-row';
  addRowNode.append(add);
  const note = document.createElement('p');
  note.className = 'fl-hint fl-info';
  const noteText = document.createElement('span');
  noteText.textContent = 'Separate several search terms with commas, such as "Mara, Teo". Each matches whole words, in any case.';
  note.append(icon('info'), noteText);

  const save = () => {
    const list = [...rows.children].map((row) => ({
      terms: splitTerms(row.querySelector('.fl-hl-terms').value).join(', '),
      color: row.querySelector('.fl-hl-color').dataset.color,
      enabled: row.dataset.enabled === 'true',
    }));
    modal.close();
    onSave(normalizeHighlights(list));
  };

  const modal = openModal(parent, {
    title: 'Highlight Manager',
    icon: 'highlighter',
    body: [rows, addRowNode, note],
    onClose,
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() }),
      button({ label: 'OK', cls: 'fl-btn-primary', onClick: save }),
    ],
  });
  modal.dialog.classList.add('fl-hl-dialog');
  picker = colorPopover(modal.dialog, rows);
  modal.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.classList.contains('fl-hl-terms')) {
      event.preventDefault();
      save();
    }
  });
  first?.focus();
  return modal;
}

// vanilla-colorful's pickers are custom elements, loaded the first time one is wanted. An app
// that already defined them keeps its own.
const loadPicker = () => Promise.all([
  customElements.get('hex-color-picker') || import('vanilla-colorful/hex-color-picker.js'),
  customElements.get('hex-input') || import('vanilla-colorful/hex-input.js'),
]);

// #abc as #aabbcc, and nothing at all for anything that isn't a color yet.
function fullHex(value) {
  const hex = String(value ?? '').replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join('')}`;
  return null;
}

const PICKER_MARGIN = 8;

/**
 * A color picker that opens beside a swatch button in `dialog`: a square of shades and a strip
 * of hues to drag, the highlighter colors to pick from, and the color as hex to type. It's
 * placed against the screen, so the dialog's edges and the rows' scrolling don't cut it off.
 */
function colorPopover(dialog, scroller) {
  const panel = document.createElement('div');
  panel.className = 'fl-hl-picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Choose a highlight color');
  panel.hidden = true;

  const picker = document.createElement('hex-color-picker');
  const presets = document.createElement('div');
  presets.className = 'fl-hl-presets';
  const presetButtons = HIGHLIGHT_COLORS.map((hex) => {
    const preset = document.createElement('button');
    preset.type = 'button';
    preset.className = 'fl-hl-preset';
    preset.style.setProperty('--fl-hl-color', hex);
    preset.setAttribute('aria-label', `Use ${hex}`);
    preset.title = hex;
    preset.dataset.color = hex;
    preset.addEventListener('click', () => pick(hex));
    presets.append(preset);
    return preset;
  });
  const hexInput = document.createElement('hex-input');
  hexInput.setAttribute('prefixed', '');
  const field = document.createElement('input');
  field.className = 'fl-hl-hex';
  field.setAttribute('aria-label', 'Hex color');
  field.spellcheck = false;
  field.autocomplete = 'off';
  hexInput.append(field);
  panel.append(picker, presets, hexInput);
  dialog.append(panel);

  let anchor = null;
  let onPick = null;

  const markPreset = (hex) => {
    for (const preset of presetButtons) preset.setAttribute('aria-pressed', String(preset.dataset.color === hex));
  };

  function pick(value, from) {
    const hex = fullHex(value);
    if (!hex || !anchor) return;
    if (from !== picker) picker.color = hex;
    if (from !== hexInput) hexInput.color = hex;
    markPreset(hex);
    onPick(hex);
  }
  picker.addEventListener('color-changed', (event) => pick(event.detail.value, picker));
  hexInput.addEventListener('color-changed', (event) => pick(event.detail.value, hexInput));

  // Below the swatch, or above it when there's no room below, and always on screen.
  const place = () => {
    const swatch = anchor.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const left = Math.min(Math.max(PICKER_MARGIN, swatch.right - width), window.innerWidth - width - PICKER_MARGIN);
    let top = swatch.bottom + 6;
    if (top + height > window.innerHeight - PICKER_MARGIN) top = Math.max(PICKER_MARGIN, swatch.top - height - 6);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const close = (refocus = false) => {
    if (!anchor) return;
    const was = anchor;
    panel.hidden = true;
    was.setAttribute('aria-expanded', 'false');
    anchor = null;
    onPick = null;
    if (refocus) was.focus();
  };

  dialog.addEventListener('pointerdown', (event) => {
    if (anchor && !event.composedPath().some((node) => node === panel || node === anchor)) close();
  });
  // Escape, or Enter in the hex field, closes the picker alone, leaving the Highlight Manager open.
  dialog.addEventListener('keydown', (event) => {
    if (!anchor) return;
    if (event.key === 'Escape' || (event.key === 'Enter' && event.composedPath().includes(field))) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  dialog.addEventListener('cancel', (event) => {
    if (!anchor) return;
    event.preventDefault();
    close(true);
  });
  scroller.addEventListener('scroll', () => close(), { passive: true });
  const onResize = () => close();
  window.addEventListener('resize', onResize);
  dialog.addEventListener('close', () => window.removeEventListener('resize', onResize));

  return {
    close,
    toggle(button, hex, callback, fromKeyboard) {
      if (anchor === button) return close();
      close();
      anchor = button;
      onPick = callback;
      button.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      picker.color = hex;
      hexInput.color = hex;
      markPreset(hex);
      place();
      // Its size settles once the picker's own elements are defined.
      loadPicker().then(() => {
        if (anchor !== button) return;
        place();
        if (fromKeyboard) (presetButtons.find((preset) => preset.dataset.color === hex) ?? presetButtons[0]).focus();
      }).catch(() => {});
    },
  };
}
