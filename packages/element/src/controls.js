// The interface's building blocks, shared by the element and the apps around it, so a
// pill or a menu looks and behaves the same wherever it appears. Everything here is
// plain DOM styled by CONTROLS_CSS, whose look comes from the tokens in CONTROL_TOKENS.
//
// Controls cancel mousedown so that clicking them keeps the editor's focus, selection
// and active line.

const ICONS = {
  stack: '<path d="M14 6V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/><path d="M18 10V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/><rect x="11" y="11" width="10" height="10" rx="2"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3"/><path d="M7 21v-7h10v7"/>',
  'save-as': '<path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v2"/><path d="M7 3v5h8V3"/><path d="M7 21v-6h5"/><path d="M20.5 13.5a1.5 1.5 0 0 1 2 2L17 21l-3 1 1-3z"/>',
  pdf: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  comment: '<path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  seamless: '<path d="M4 3h16"/><path d="M4 21h16"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>',
  paged: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
  write: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  outline: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
  read: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  source: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/>',
  palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3c.6.8 0 2.7-1.5 2.7z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="12" cy="7.5" r=".5"/><circle cx="16.5" cy="10.5" r=".5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  act: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  sequence: '<path d="M5 4v7a4 4 0 0 0 4 4h11"/><path d="m15 10 5 5-5 5"/>',
  synopsis: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
  scene: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  'page-break': '<path d="M6 8V4a1 1 0 0 1 1-1h7l4 4v1"/><path d="M6 16v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/><path d="M3 12h2"/><path d="M8 12h2"/><path d="M14 12h2"/><path d="M19 12h2"/>',
};

const GLYPH_FONT = '"Courier Prime", "Courier New", Courier, monospace';
const MENU_MARGIN = 8;

function setAttrs(node, attrs = {}) {
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
}

function div(className, ...children) {
  const node = document.createElement('div');
  node.className = className;
  node.append(...children);
  return node;
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('fl-svg');
  setAttrs(svg, { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.innerHTML = ICONS[name];
  return svg;
}

// Characters like . and ^ sit far from the middle of their line, so centering the
// text box isn't enough. This measures the glyph's ink and centers that instead.
let glyphContext = null;

function centerGlyph(glyph) {
  glyphContext ??= document.createElement('canvas').getContext('2d');
  const ctx = glyphContext;
  const size = 100;
  ctx.font = `700 ${size}px ${GLYPH_FONT}`;
  const m = ctx.measureText(glyph.textContent);
  const dx = m.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const dy = (m.fontBoundingBoxDescent - m.fontBoundingBoxAscent) / 2 - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  glyph.style.transform = `translate(${(dx / size).toFixed(3)}em, ${(dy / size).toFixed(3)}em)`;
}

export const centerGlyphs = (root) => root.querySelectorAll('.fl-icon-glyph').forEach(centerGlyph);

/** A badge showing what you could type by hand, such as the > of a transition. */
export function glyphBadge(text) {
  const glyph = document.createElement('span');
  glyph.className = 'fl-icon-glyph';
  glyph.style.fontFamily = GLYPH_FONT;
  glyph.textContent = text;
  centerGlyph(glyph);
  const badge = document.createElement('span');
  badge.className = 'fl-icon';
  badge.setAttribute('aria-hidden', 'true');
  badge.append(glyph);
  return badge;
}

// The scrolling area a control sits in, following slots out of shadow roots. Controls that
// float in it are cut off at its edges, which stop short of its scrollbars.
function scrollAreaOf(node) {
  let current = node;
  while (current) {
    if (current.classList?.contains('fl-scroll')) return current;
    current = current.assignedSlot ?? current.parentNode ?? current.host;
  }
  return null;
}

const graphicFor = ({ icon: iconName, glyph }) => {
  if (iconName) return icon(iconName);
  return glyph ? glyphBadge(glyph) : null;
};

/**
 * A button, or a link when given an `href`. `text` shows in place of an icon, such as
 * the B of bold. `collapse` hides the label when space runs short and `iconOnly` always
 * does; either way `label` stays the accessible name.
 */
export function button({ label, title = label, icon: iconName, glyph, text, iconOnly, collapse, toggle, href, cls, attrs, onClick }) {
  const node = document.createElement(href ? 'a' : 'button');
  if (href) node.href = href;
  else node.type = 'button';
  node.className = `fl-btn${cls ? ` ${cls}` : ''}`;
  node.title = title;
  node.setAttribute('aria-label', label);
  if (toggle) node.setAttribute('aria-pressed', 'false');
  setAttrs(node, attrs);
  const graphic = graphicFor({ icon: iconName, glyph });
  if (graphic) node.append(graphic);
  if (text) node.append(text);
  else if (!iconOnly) {
    const span = document.createElement('span');
    span.className = collapse ? 'fl-label fl-collapse' : 'fl-label';
    span.textContent = label;
    node.append(span);
  }
  node.addEventListener('mousedown', (e) => e.preventDefault());
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

/** A floating pill holding related controls. */
export function pill({ cls, label, attrs } = {}, ...children) {
  const node = div(`fl-pill${cls ? ` ${cls}` : ''}`, ...children);
  node.setAttribute('role', 'group');
  if (label) node.setAttribute('aria-label', label);
  setAttrs(node, attrs);
  return node;
}

export function pillSep() {
  const sep = div('fl-pill-sep');
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

// Two forms of the same control, swapped by CSS as the space around them changes.
function responsive(attrs, wide, compact) {
  const node = div('fl-responsive', div('fl-wide-only', wide), div('fl-compact-only', compact));
  setAttrs(node, attrs);
  return node;
}

/**
 * Tabs, as a pill of tabs or, when space runs short, a dropdown naming the current one.
 * Items are { label, icon, selected, disabled, title }, and `onSelect` gets the label of a tab
 * the writer switches to.
 */
export function tabs({ label, attrs, onSelect }, items) {
  let current = items.find((item) => item.selected);
  let menu = null;
  const select = (item) => {
    if (item === current) return;
    current = item;
    for (const [other, tab] of nodes) tab.setAttribute('aria-selected', String(other === item));
    menu.refresh();
    onSelect?.(item.label);
  };
  const nodes = new Map(items.map((item) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'fl-tab';
    if (item.icon) tab.append(icon(item.icon));
    tab.append(item.label);
    tab.disabled = !!item.disabled;
    if (item.title) tab.title = item.title;
    setAttrs(tab, { role: 'tab', 'aria-selected': String(!!item.selected) });
    tab.addEventListener('mousedown', (e) => e.preventDefault());
    tab.addEventListener('click', () => select(item));
    return [item, tab];
  }));
  const wide = pill({ cls: 'fl-tabs', label }, ...nodes.values());
  wide.setAttribute('role', 'tablist');

  menu = new Menu({
    sections: [{ items: items.map((item) => ({ ...item, value: item.label })) }],
    isChecked: (value) => value === current.label,
    trigger: () => {
      const name = document.createElement('span');
      name.textContent = current.label;
      return { label: `${label}: ${current.label}`, content: [...(current.icon ? [icon(current.icon)] : []), name] };
    },
    onSelect: (value) => select(items.find((item) => item.label === value)),
  });
  return responsive(attrs, wide, pill({ cls: 'fl-tabs', label }, menu.root));
}

/**
 * Actions, as a pill of icon buttons or, when space runs short, a vertical ... menu with
 * their names. Groups are lists of { label, title, icon, attrs, onClick }, and are kept apart
 * in both forms.
 */
export function actionPill({ label, cls, attrs }, groups) {
  const wide = pill({ cls, label }, ...groups.flatMap((group, i) => [
    ...(i ? [pillSep()] : []),
    ...group.map((action) => button({ ...action, iconOnly: true })),
  ]));
  const actions = new Map(groups.flat().map((action) => [action.label, action]));
  const menu = new Menu({
    caret: false,
    sections: groups.map((group) => ({ plain: true, items: group.map(({ label: name, title, icon: iconName }) => ({ value: name, label: name, title, icon: iconName })) })),
    trigger: () => ({ label, content: [icon('more')] }),
    onSelect: (name) => actions.get(name).onClick(),
  });
  return responsive(attrs, wide, pill({ label }, menu.root));
}

/**
 * A dropdown. `sections` are { label, plain, items }, and items are { value, label, title,
 * icon, glyph, disabled }; `plain` marks actions that are done rather than chosen. `trigger()`
 * returns the button's current { label, content }, and refresh() redraws it and the checks.
 */
export class Menu {
  #trigger;
  #isChecked;
  #up;
  #caret;
  #items = [];
  #onDocument = (e) => this.#handleDocument(e);
  #place = () => this.#keepOnScreen();

  constructor({ sections, trigger, isChecked = () => false, onSelect, up = false, caret = true, cls, triggerCls, attrs }) {
    this.#trigger = trigger;
    this.#isChecked = isChecked;
    this.#up = up;
    this.#caret = caret;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = `fl-btn fl-menu-trigger${triggerCls ? ` ${triggerCls}` : ''}`;
    setAttrs(this.button, { 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
    this.button.addEventListener('mousedown', (e) => e.preventDefault());
    // A click with no detail came from the keyboard, so focus has to follow into the menu.
    this.button.addEventListener('click', (e) => this.toggle(e.detail === 0));
    this.button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && !this.isOpen) {
        e.preventDefault();
        this.open(true);
      }
    });

    this.popup = div(`fl-menu-popup${up ? ' fl-menu-up' : ''}`);
    this.popup.setAttribute('role', 'menu');
    this.popup.hidden = true;
    for (const section of sections) {
      if (section.label) {
        const heading = div('fl-menu-heading');
        heading.textContent = section.label;
        this.popup.append(heading);
      } else if (this.popup.childElementCount) {
        this.popup.append(div('fl-menu-rule'));
      }
      for (const item of section.items) this.popup.append(this.#buildItem(item, section, onSelect));
    }

    this.root = div(`fl-menu${cls ? ` ${cls}` : ''}`, this.button, this.popup);
    setAttrs(this.root, attrs);
    this.refresh();
  }

  get isOpen() {
    return !this.popup.hidden;
  }

  refresh() {
    const { label, content } = this.#trigger();
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
    this.button.replaceChildren(...content, ...(this.#caret ? [icon('chevron')] : []));
    for (const { node, item, section } of this.#items) {
      if (!section.plain) node.setAttribute('aria-checked', String(this.#isChecked(item.value)));
    }
  }

  toggle(moveFocus) {
    if (this.isOpen) this.close();
    else this.open(moveFocus);
  }

  open(moveFocus) {
    this.popup.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.#keepOnScreen();
    document.addEventListener('pointerdown', this.#onDocument, true);
    document.addEventListener('keydown', this.#onDocument, true);
    window.addEventListener('resize', this.#place);
    if (moveFocus) (this.#items.find(({ node }) => node.getAttribute('aria-checked') === 'true') ?? this.#items.find(({ node }) => !node.disabled)).node.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.popup.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.#onDocument, true);
    document.removeEventListener('keydown', this.#onDocument, true);
    window.removeEventListener('resize', this.#place);
  }

  #buildItem(item, section, onSelect) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'fl-menu-item';
    node.title = item.title ?? item.label;
    node.disabled = !!item.disabled;
    setAttrs(node, { role: section.plain ? 'menuitem' : 'menuitemradio', 'aria-label': item.label, tabindex: '-1' });
    const graphic = graphicFor(item);
    const text = document.createElement('span');
    text.textContent = item.label;
    node.append(...(graphic ? [graphic] : []), text);
    if (!section.plain) node.append(icon('check'));
    node.addEventListener('mousedown', (e) => e.preventDefault());
    node.addEventListener('click', (e) => {
      this.close();
      if (e.detail === 0) this.button.focus();
      onSelect?.(item.value);
    });
    this.#items.push({ node, item, section });
    return node;
  }

  #handleDocument(event) {
    if (event.type === 'pointerdown') {
      if (!event.composedPath().includes(this.root)) this.close();
      return;
    }
    const nodes = this.#items.map(({ node }) => node).filter((node) => !node.disabled);
    const index = nodes.indexOf(this.root.getRootNode().activeElement);
    if (event.key === 'Escape') {
      this.close();
      if (index >= 0) this.button.focus();
    } else if (event.key === 'Tab') {
      this.close();
    } else if (index >= 0 && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: nodes.length - 1 }[event.key];
      nodes[(next + nodes.length) % nodes.length].focus();
    }
  }

  // The trigger moves as its row wraps, so the popup can't rely on a fixed anchor.
  #keepOnScreen() {
    const { popup } = this;
    popup.style.left = '';
    popup.style.top = '';
    popup.style.maxHeight = '';
    // Anchored to something further out than its menu, it has to be placed by hand.
    let startLeft = 0;
    if (getComputedStyle(this.root).position === 'static') {
      const parent = popup.offsetParent.getBoundingClientRect();
      const trigger = this.button.getBoundingClientRect();
      startLeft = trigger.left - parent.left;
      popup.style.left = `${startLeft}px`;
      popup.style.top = `${trigger.bottom - parent.top + 6}px`;
    }
    const rect = popup.getBoundingClientRect();
    const area = scrollAreaOf(popup);
    const origin = area?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const minLeft = origin.left + MENU_MARGIN;
    const maxRight = origin.left + (area ?? document.documentElement).clientWidth - MENU_MARGIN;
    const maxBottom = area ? origin.top + area.clientHeight - MENU_MARGIN : window.innerHeight - MENU_MARGIN;
    let shift = 0;
    if (rect.right > maxRight) shift = maxRight - rect.right;
    if (rect.left + shift < minLeft) shift = minLeft - rect.left;
    // Chrome lets a transformed menu's original position widen what can scroll, so this moves
    // it with left instead.
    if (shift) popup.style.left = `${startLeft + shift}px`;
    const room = this.#up ? rect.bottom - origin.top - MENU_MARGIN : maxBottom - rect.top;
    if (rect.height > room) popup.style.maxHeight = `${Math.max(room, 120)}px`;
  }
}

/**
 * Opens a modal in `parent`, whose styles it needs to see. `onClose` runs however it
 * closes, including with Escape.
 */
export function openModal(parent, { title, body, actions, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'fl-dialog';
  dialog.setAttribute('aria-labelledby', 'fl-dialog-title');
  const heading = document.createElement('h2');
  heading.id = 'fl-dialog-title';
  heading.textContent = title;
  dialog.append(heading, div('fl-dialog-body', ...body), div('fl-dialog-actions', ...actions));
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  parent.append(dialog);
  dialog.showModal();
  return { dialog, close: () => dialog.close() };
}

// What each component's look is built from. Any of these can be set from outside as
// --flow-<name>, in CSS or through registerTheme, and each defaults to the theme's colors.
const CONTROL_TOKENS = {
  'pill-bg': 'var(--flow-ribbon-bg)',
  'pill-ink': 'var(--flow-ribbon-ink)',
  'pill-border': 'var(--flow-rule)',
  'pill-radius': '999px',
  'pill-shadow': '0 2px 6px var(--flow-shadow)',
  // Kept tighter than the gap between pills, so that each shows as its own shape.
  'float-shadow': '0 1px 2px var(--flow-shadow), 0 2px 4px var(--flow-shadow), 0 3px 7px var(--flow-shadow)',
  'pill-tint-bg': 'color-mix(in srgb, var(--flow-accent) 18%, var(--flow-ribbon-bg))',
  'pill-tint-border': 'color-mix(in srgb, var(--flow-accent) 35%, var(--flow-rule))',
  'button-radius': '999px',
  'button-hover-bg': 'color-mix(in srgb, var(--flow-accent) 15%, transparent)',
  'button-active-bg': 'var(--flow-accent)',
  'button-active-ink': 'var(--flow-accent-ink)',
  'tabs-bg': 'var(--flow-pill-tint-bg, color-mix(in srgb, var(--flow-accent) 18%, var(--flow-ribbon-bg)))',
  'tabs-border': 'var(--flow-pill-tint-border, color-mix(in srgb, var(--flow-accent) 35%, var(--flow-rule)))',
  'tabs-ink': 'var(--flow-ribbon-ink)',
  'tab-selected-bg': 'var(--flow-accent)',
  'tab-selected-ink': 'var(--flow-accent-ink)',
  'menu-bg': 'var(--flow-ribbon-bg)',
  'menu-ink': 'var(--flow-ribbon-ink)',
  'menu-border': 'var(--flow-rule)',
  'menu-radius': '10px',
  'menu-heading-bg': 'var(--flow-accent)',
  'menu-heading-ink': 'var(--flow-accent-ink)',
  'dialog-bg': 'var(--flow-desk)',
  'dialog-ink': 'var(--flow-ink)',
  'dialog-radius': '12px',
  focus: 'var(--flow-accent)',
  scrollbar: 'var(--flow-accent)',
  // Checkboxes, radio buttons, sliders and progress bars.
  check: 'var(--flow-accent)',
  'field-bg': 'var(--flow-paper)',
  'field-ink': 'var(--flow-ink)',
  'field-border': 'var(--flow-rule)',
  'selection-bg': 'color-mix(in srgb, var(--flow-accent) 30%, transparent)',
  // Where a dragged card will land, and where a tool would add one.
  'drop-line': 'var(--flow-accent)',
  'preview-line': 'var(--flow-secondary)',
  // Pointing at something that deletes.
  'danger-hover': 'var(--flow-danger)',
};

/** The token's value, falling back to its default when nobody has set it. */
export const token = (name) => `var(--flow-${name}, ${CONTROL_TOKENS[name]})`;

export const CONTROLS_CSS = `
.fl-svg {
  flex: none; width: 1.25em; height: 1.25em;
  fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.fl-icon {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  min-width: 1.5em; height: 1.5em; padding: 0 0.2em;
  border: 1px solid var(--flow-accent); border-radius: 3px;
  background: color-mix(in srgb, var(--flow-accent) 12%, transparent);
  color: var(--flow-accent);
  font-size: 0.95em; font-weight: 700; line-height: 1;
}
.fl-icon-glyph { display: block; white-space: pre; }

.fl-pill {
  display: inline-flex; align-items: center; gap: 2px; min-width: 0; padding: var(--fl-pill-pad, 3px);
  background: ${token('pill-bg')}; color: ${token('pill-ink')};
  border: 1px solid ${token('pill-border')}; border-radius: ${token('pill-radius')};
  box-shadow: ${token('pill-shadow')};
  font-size: var(--fl-pill-font, 13px); line-height: 1.25;
}
.fl-pill[hidden] { display: none; }
/* Pills take clicks even where the bar around them lets clicks through. */
.fl-pill { pointer-events: auto; }
/* Lighter than the primary color, for information rather than actions. */
.fl-pill-tinted { background: ${token('pill-tint-bg')}; border-color: ${token('pill-tint-border')}; }
.fl-pill-sep { flex: none; width: 1px; height: 1.4em; margin: 0 2px; background: currentColor; opacity: 0.25; }
.fl-pill-sep[hidden] { display: none; }

.fl-btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: none;
  min-width: var(--fl-control-size, 30px); min-height: var(--fl-control-size, 30px); padding: 3px var(--fl-control-pad, 8px);
  background: transparent; color: inherit;
  border: 0; border-radius: ${token('button-radius')};
  font: inherit; text-decoration: none; white-space: nowrap; cursor: pointer;
}
.fl-btn[hidden] { display: none; }
.fl-btn:hover:not(:disabled) { background: ${token('button-hover-bg')}; }
.fl-btn:focus-visible, .fl-tab:focus-visible, .fl-menu-item:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: 1px; }
input[type="checkbox"], input[type="radio"], input[type="range"], progress { accent-color: ${token('check')}; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: 1px; }
.fl-btn[aria-pressed="true"], .fl-btn[aria-pressed="true"]:hover:not(:disabled), .fl-btn-primary, .fl-btn-primary:hover:not(:disabled) {
  background: ${token('button-active-bg')}; color: ${token('button-active-ink')};
}
.fl-btn[aria-pressed="true"] .fl-icon { color: inherit; border-color: currentColor; background: transparent; }
/* A quieter pressed look: the secondary color behind, with only the icon in primary. */
.fl-btn-soft[aria-pressed="true"], .fl-btn-soft[aria-pressed="true"]:hover:not(:disabled) { background: ${token('pill-tint-bg')}; color: inherit; }
.fl-btn-soft[aria-pressed="true"] .fl-icon { background: ${token('button-active-bg')}; border-color: ${token('button-active-bg')}; color: ${token('button-active-ink')}; }
.fl-btn:disabled { opacity: 0.4; cursor: default; }
.fl-btn-outline { border: 1px solid ${token('pill-border')}; }

.fl-tabs { align-items: stretch; background: ${token('tabs-bg')}; border-color: ${token('tabs-border')}; color: ${token('tabs-ink')}; }
.fl-tab {
  appearance: none; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 3px 16px 3px 12px;
  background: transparent; color: inherit;
  border: 0; border-radius: ${token('button-radius')};
  font: inherit; font-weight: 600; white-space: nowrap; cursor: pointer;
}
.fl-tab:focus-visible { outline-color: ${token('tabs-ink')}; }
.fl-tab[aria-selected="true"] { background: ${token('tab-selected-bg')}; color: ${token('tab-selected-ink')}; }
.fl-tab:disabled { opacity: 0.8; cursor: default; }
.fl-tab .fl-svg { width: 1.1em; height: 1.1em; }
/* On small screens a dropdown names the current tab, in the same type as the tabs. */
.fl-tabs .fl-menu-trigger { font-weight: 600; }

.fl-menu { position: relative; display: inline-flex; }
.fl-menu-trigger > .fl-svg:not(:only-child):last-child { width: 1em; height: 1em; }
.fl-menu-popup {
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 30;
  display: flex; flex-direction: column; gap: 1px;
  min-width: 11rem; max-width: calc(100vw - 16px); padding: 6px; overflow-y: auto;
  background: ${token('menu-bg')}; color: ${token('menu-ink')};
  border: 1px solid ${token('menu-border')}; border-radius: ${token('menu-radius')};
  box-shadow: 0 6px 20px var(--flow-shadow);
  font-size: 13px; line-height: 1.25;
}
.fl-menu-popup[hidden] { display: none; }
.fl-menu-up { top: auto; bottom: calc(100% + 6px); }
.fl-menu-heading {
  flex: none; padding: 3px 8px; border-radius: 6px;
  background: ${token('menu-heading-bg')}; color: ${token('menu-heading-ink')};
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
.fl-menu-item + .fl-menu-heading { margin-top: 5px; }
.fl-menu-rule { flex: none; height: 1px; margin: 4px 2px; background: ${token('menu-border')}; }
.fl-menu-item {
  appearance: none; display: flex; align-items: center; gap: 8px; flex: none; width: 100%; min-height: 30px; padding: 3px 8px;
  background: transparent; color: inherit;
  border: 0; border-radius: 6px;
  font: inherit; text-align: left; white-space: nowrap; cursor: pointer;
}
.fl-menu-item > span:not(.fl-icon) { flex: 1; }
.fl-menu-item:hover:not(:disabled) { background: ${token('button-hover-bg')}; }
.fl-menu-item > .fl-svg:last-child { visibility: hidden; width: 1em; height: 1em; color: var(--flow-accent); }
.fl-menu-item:disabled { opacity: 0.5; cursor: default; }
.fl-menu-item[aria-checked="true"] { font-weight: 600; }
.fl-menu-item[aria-checked="true"] > .fl-svg:last-child { visibility: visible; }

/* Space runs short in stages, measured from the bar the control sits in. */
.fl-responsive, .fl-wide-only { display: contents; }
.fl-compact-only { display: none; }
@container (max-width: 760px) {
  .fl-collapse { display: none; }
}
@container (max-width: 600px) {
  .fl-wide-only, .fl-compact-hide { display: none; }
  .fl-compact-only { display: contents; }
}

.fl-dialog {
  width: min(460px, calc(100vw - 32px)); padding: 20px;
  background: ${token('dialog-bg')}; color: ${token('dialog-ink')};
  border: 1px solid var(--flow-rule); border-radius: ${token('dialog-radius')};
  box-shadow: 0 10px 40px var(--flow-shadow);
  font-size: 14px;
}
.fl-dialog::backdrop { background: rgb(0 0 0 / 0.4); }
.fl-dialog h2 {
  margin: 0 0 14px; color: var(--flow-muted);
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.fl-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.fl-dialog-actions .fl-btn { padding-inline: 14px; }
`;
