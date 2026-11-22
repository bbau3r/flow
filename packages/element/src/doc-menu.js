// The Document menu: the pill at the left of the top row, holding the menu icon and whatever the
// app puts in the `document` slot, and the card of commands it opens. An item with a panel, such
// as Theme, swaps the card for one of its own, which rises from behind, with a back button. On a large screen the
// cards hang below the pill; on a small one they fly out from the left and take most of the
// screen. The cards live in a modal dialog, so they sit above everything else, keep focus to
// themselves and close with Escape or a click outside.

import { icon, token } from './controls.js';

// The same width as the container queries that fold the bars.
const SMALL = '(max-width: 600px)';

const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
};

/**
 * `groups` are lists of items { label, icon, shortcut, title, attrs, onClick, panel }, kept
 * apart by rules. `panel` is { title, build(menu) } and returns the nodes of the card it opens.
 * `onClose` runs whenever the menu closes, after the item chosen if any.
 */
export function createDocMenu({ label = 'Document', onClose } = {}) {
  let groups = [];
  const trigger = el('button', 'fl-pill fl-pill-tinted fl-docmenu-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.title = 'Menu';
  const slot = document.createElement('slot');
  slot.name = 'document';
  slot.append(el('span', 'fl-docmenu-label', label));
  trigger.append(icon('menu'), slot);
  trigger.setAttribute('aria-label', `${label} menu`);

  const stack = el('div', 'fl-docmenu-stack');
  const dialog = el('dialog', 'fl-docmenu', stack);
  dialog.setAttribute('aria-label', `${label} menu`);
  // The dialog is only in the page while the menu is open.
  const root = el('div', 'fl-docmenu-holder', trigger);

  let layers = [];
  let after = null;

  const top = () => layers[layers.length - 1];

  // Only the card on top shows. The one it replaces drops back as the new one comes forward.
  const swap = (leaving, coming) => {
    if (leaving) {
      leaving.classList.remove('fl-docmenu-coming');
      leaving.classList.add('fl-docmenu-leaving');
      leaving.inert = true;
      const done = () => {
        leaving.classList.remove('fl-docmenu-leaving');
        if (leaving.isConnected && leaving !== top()) leaving.hidden = true;
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
      else leaving.addEventListener('animationend', done, { once: true });
    }
    coming.hidden = false;
    coming.inert = false;
    coming.classList.remove('fl-docmenu-coming');
    // Restart the animation on a card that has played it before.
    void coming.offsetWidth;
    coming.classList.add('fl-docmenu-coming');
  };

  const focusIn = (layer) => {
    const target = layer.querySelector('[aria-checked="true"], .fl-docmenu-item:not(:disabled), button:not(:disabled), input, select');
    target?.focus({ preventScroll: true });
  };

  function back() {
    if (layers.length < 2) return close();
    const leaving = layers.pop();
    swap(leaving, top());
    leaving.addEventListener('animationend', () => leaving.remove(), { once: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) leaving.remove();
    focusIn(top());
  }

  function close(then) {
    after = then ?? null;
    if (dialog.open) dialog.close();
  }

  const menuApi = { close: () => close(), back };

  function openPanel(item) {
    const card = el('div', 'fl-docmenu-card fl-docmenu-panel');
    card.setAttribute('role', 'group');
    const backButton = el('button', 'fl-btn fl-docmenu-back', icon('chevron-left'));
    backButton.type = 'button';
    backButton.setAttribute('aria-label', 'Back');
    backButton.title = 'Back';
    backButton.addEventListener('click', back);
    const heading = el('h2', 'fl-docmenu-title', item.panel.title ?? item.label);
    heading.id = `fl-docmenu-panel-${layers.length}`;
    card.setAttribute('aria-labelledby', heading.id);
    const body = el('div', 'fl-docmenu-body');
    const built = item.panel.build(menuApi);
    body.append(...(Array.isArray(built) ? built : [built]));
    card.append(el('div', 'fl-docmenu-head', backButton, heading), body);
    const leaving = top();
    layers.push(card);
    stack.append(card);
    swap(leaving, card);
    focusIn(card);
  }

  function buildItem(item) {
    const node = el('button', 'fl-docmenu-item');
    node.type = 'button';
    node.setAttribute('role', 'menuitem');
    node.title = item.title ?? item.label;
    // The shortcut shows beside the name, but isn't part of it.
    node.setAttribute('aria-label', item.label);
    for (const [key, value] of Object.entries(item.attrs ?? {})) node.setAttribute(key, value);
    if (item.icon) node.append(icon(item.icon));
    node.append(el('span', 'fl-docmenu-name', item.label));
    if (item.shortcut) node.append(el('kbd', 'fl-docmenu-key', item.shortcut));
    if (item.panel) {
      node.setAttribute('aria-haspopup', 'true');
      node.append(icon('chevron-right'));
      node.addEventListener('click', () => openPanel(item));
    } else {
      node.addEventListener('click', () => close(item.onClick));
    }
    return node;
  }

  function buildMain() {
    const card = el('div', 'fl-docmenu-card fl-docmenu-main');
    card.setAttribute('role', 'menu');
    card.setAttribute('aria-label', label);
    card.tabIndex = -1;
    groups.filter((group) => group.length).forEach((group, i) => {
      if (i) card.append(el('div', 'fl-docmenu-rule'));
      card.append(...group.map(buildItem));
    });
    return card;
  }

  // On a large screen the cards hang from the pill, kept on screen.
  function place() {
    const small = matchMedia(SMALL).matches;
    dialog.dataset.mode = small ? 'sheet' : 'card';
    dialog.style.left = '';
    dialog.style.top = '';
    if (small) return;
    const box = trigger.getBoundingClientRect();
    dialog.style.left = `${Math.max(4, box.left - 8)}px`;
    dialog.style.top = `${box.bottom - 2}px`;
  }

  // Opened from the keyboard, focus goes to the first item. Opened with a pointer, it waits on
  // the card, so nothing looks picked before anything is pointed at.
  function open(fromKeyboard = true) {
    if (dialog.open) return;
    layers = [buildMain()];
    stack.replaceChildren(...layers);
    root.append(dialog);
    place();
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    if (fromKeyboard) focusIn(layers[0]);
    else layers[0].focus({ preventScroll: true });
    window.addEventListener('resize', place);
  }

  trigger.addEventListener('mousedown', (e) => e.preventDefault());
  // A click with no detail came from the keyboard.
  trigger.addEventListener('click', (e) => (dialog.open ? close() : open(e.detail === 0)));

  // Escape steps back a card before it closes the menu.
  dialog.addEventListener('cancel', (event) => {
    if (layers.length > 1) {
      event.preventDefault();
      back();
    }
  });
  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', place);
    stack.replaceChildren();
    dialog.remove();
    layers = [];
    const then = after;
    after = null;
    onClose?.({ chose: !!then });
    then?.();
  });
  // A click on the dialog itself, not on a card, is a click outside the menu.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  // The arrow keys move between the items of the card on top.
  dialog.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const layer = top();
    if (!layer?.classList.contains('fl-docmenu-main')) return;
    const items = [...layer.querySelectorAll('.fl-docmenu-item:not(:disabled)')];
    const index = items.indexOf(layer.getRootNode().activeElement);
    event.preventDefault();
    if (index < 0) return items[event.key === 'ArrowUp' || event.key === 'End' ? items.length - 1 : 0]?.focus();
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
    items[(next + items.length) % items.length]?.focus();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' && layers.length > 1 && !/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) {
      event.preventDefault();
      back();
    }
  });

  return {
    root,
    trigger,
    get isOpen() { return dialog.open; },
    setItems(next) {
      groups = next;
      if (dialog.open) close();
    },
    open,
    close: () => close(),
  };
}

export const DOC_MENU_CSS = `
.fl-docmenu-holder { display: flex; min-width: 0; }
.fl-docmenu-trigger {
  appearance: none; flex: 0 1 auto; min-width: 0; gap: 8px; padding: 3px 16px 3px 10px;
  /* As tall as a pill of controls, such as the tabs, even when it holds one line. */
  min-height: calc(var(--fl-control-size, 30px) + 2 * var(--fl-pill-pad, 3px) + 2px);
  font: inherit; text-align: left; cursor: pointer;
}
.fl-docmenu-trigger:hover { background: color-mix(in srgb, var(--flow-accent) 26%, var(--flow-ribbon-bg)); }
.fl-docmenu-trigger:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: 1px; }
.fl-docmenu-trigger[aria-expanded="true"] { background: color-mix(in srgb, var(--flow-accent) 30%, var(--flow-ribbon-bg)); }
.fl-docmenu-trigger > .fl-svg {
  box-sizing: content-box; width: 1.3em; height: 1.3em; padding: 4px; margin: -4px -2px -4px -4px;
  border-radius: 999px; transition: background-color 120ms ease;
}
.fl-docmenu-trigger:hover > .fl-svg, .fl-docmenu-trigger[aria-expanded="true"] > .fl-svg { background: ${token('button-active-bg')}; color: ${token('button-active-ink')}; }
.fl-docmenu-label { font-weight: 600; padding-right: 4px; }
.fl-docmenu-trigger ::slotted(*) { min-width: 0; }

.fl-docmenu {
  position: fixed; inset: auto; margin: 0; padding: 10px; overflow: visible; pointer-events: auto;
  max-width: none; max-height: none;
  background: transparent; color: ${token('menu-ink')}; border: 0;
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 14px; line-height: 1.3;
}
.fl-docmenu::backdrop { background: transparent; }
.fl-docmenu-stack { position: relative; }
.fl-docmenu-card:focus { outline: none; }
.fl-docmenu-card {
  display: flex; flex-direction: column; gap: 1px;
  width: 17rem; padding: 8px;
  background: ${token('menu-bg')};
  border: 1px solid ${token('menu-border')}; border-radius: 14px;
  box-shadow: 0 8px 28px var(--flow-shadow);
}
.fl-docmenu-panel { width: 19rem; max-height: calc(100dvh - 120px); overflow: auto; }
.fl-docmenu-card[hidden] { display: none; }
/* Swapping cards: the one leaving drops back over the one coming, which rises from behind it. */
.fl-docmenu-leaving {
  position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;
  animation: fl-docmenu-back 140ms ease-in forwards;
}
.fl-docmenu-coming { animation: fl-docmenu-forward 160ms ease-out; }
@keyframes fl-docmenu-back { to { opacity: 0; transform: scale(0.92); } }
@keyframes fl-docmenu-forward { from { opacity: 0; transform: scale(0.94); } }

.fl-docmenu-item {
  appearance: none; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 38px; padding: 6px 10px;
  background: transparent; color: inherit; border: 0; border-radius: 8px;
  font: inherit; text-align: left; cursor: pointer;
}
.fl-docmenu-item:hover:not(:disabled), .fl-docmenu-item:focus-visible { background: ${token('button-hover-bg')}; }
.fl-docmenu-item:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: -2px; }
.fl-docmenu-item:disabled { opacity: 0.5; cursor: default; }
.fl-docmenu-item > .fl-svg:first-child { width: 1.3em; height: 1.3em; color: var(--flow-accent); }
.fl-docmenu-item > .fl-svg:last-child:not(:first-child) { width: 1em; height: 1em; opacity: 0.7; }
.fl-docmenu-name { flex: 1; white-space: nowrap; }
.fl-docmenu-key {
  padding: 1px 7px; border: 1px solid var(--flow-rule); border-radius: 999px;
  color: var(--flow-muted); font: 11.5px var(--flow-ui-font, Roboto, system-ui, sans-serif); white-space: nowrap;
}
.fl-docmenu-rule { flex: none; height: 1px; margin: 5px 6px; background: ${token('menu-border')}; }
.fl-docmenu-head { display: flex; align-items: center; gap: 6px; padding: 0 2px 8px; margin-bottom: 8px; border-bottom: 1px solid var(--flow-rule); }
.fl-docmenu-title { margin: 0; font-size: 16px; font-weight: 600; }
.fl-docmenu-body { display: flex; flex-direction: column; gap: 12px; padding: 0 4px 4px; }

/* On a small screen the menu flies out from the left and covers most of it. */
.fl-docmenu[data-mode="sheet"] { inset: 0; width: 100%; height: 100%; padding: 0; }
.fl-docmenu[data-mode="sheet"]::backdrop { background: rgb(0 0 0 / 0.35); }
.fl-docmenu[data-mode="sheet"] .fl-docmenu-stack {
  position: absolute; left: 0; top: 0; bottom: 0; width: min(420px, calc(100% - 48px));
  animation: fl-docmenu-fly 180ms ease-out;
}
.fl-docmenu[data-mode="sheet"] .fl-docmenu-card {
  position: absolute; inset: 0; width: auto; max-height: none; overflow: auto;
  padding: 16px 12px calc(16px + env(safe-area-inset-bottom));
  border-radius: 0 18px 18px 0; border-left: 0;
}
.fl-docmenu[data-mode="sheet"] .fl-docmenu-item { min-height: 46px; font-size: 15px; }
@keyframes fl-docmenu-fly { from { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) {
  .fl-docmenu-leaving, .fl-docmenu-coming, .fl-docmenu[data-mode="sheet"] .fl-docmenu-stack { animation: none; }
}
`;
