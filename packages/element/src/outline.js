// The Outline tab: the script's acts, sequences, scenes and transitions in order, as a column of cards
// and blocks. They hold nothing of their own. Each edit changes the script's text, and they're
// redrawn from it, so this and the Write tab can't disagree and they share one undo history.

import {
  cleanSceneNumber, setOutlineSceneNumber,
  addOutlineHeader, addOutlineSubheader, addOutlineSynopsis, moveOutlineBlock, outlineCards,
  outlineSlots, parse, removeOutlineCard, removeOutlineSynopsis, setOutlineText,
} from '@flow/core';
import { button, icon } from './controls.js';

const DRAG_THRESHOLD_PX = 4;
const SCROLL_EDGE_PX = 64;
const SCROLL_SPEED_PX = 12;
const GHOST_OFFSET_PX = 16;

const LEVEL_NAMES = { 1: 'act', 2: 'sequence' };
const levelName = (level) => LEVEL_NAMES[level] ?? 'section';
const capitalized = (name) => name[0].toUpperCase() + name.slice(1);

const element = (tag, className, ...children) => {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
};

const kindIcon = (name) => {
  const node = element('span', 'fl-outline-kind', icon(name));
  node.setAttribute('aria-hidden', 'true');
  return node;
};

const iconFor = (item) => {
  if (item.kind === 'block') return 'scene';
  if (item.kind === 'synopsis') return 'synopsis';
  return item.level === 1 ? 'act' : 'sequence';
};

// Everything that decides what's drawn, apart from the text of the fields.
const shapeOf = (items) => items.map((item) => {
  if (item.kind === 'section') return `${item.level}@${item.line}(${shapeOf(item.children)})`;
  if (item.kind === 'synopsis') return `synopsis@${item.line}`;
  return `block@${item.line}:${item.lines.map((line) => `${line.kind}:${line.forced}:${line.text}`).join('|')}`;
}).join();

const sceneNumbers = (block) => block.lines.filter((line) => line.kind === 'scene').map((line) => ({ line: line.line, text: line.number }));

const fieldItems = (items) => items.flatMap((item) => {
  if (item.kind === 'section') return [item, ...fieldItems(item.children)];
  return item.kind === 'synopsis' ? [item] : sceneNumbers(item);
});

export function createOutline({ edit, undo, redo }) {
  let lines = [''];
  let cards = [];
  let shape = null;
  let fields = [];
  let blockNodes = new Map();
  let childNodes = new Map();
  let handles = new Map();
  let typing = false;
  let focusAfterRender = null;
  let handleAfterRender = null;
  let drag = null;

  const list = element('div', 'fl-outline-list');
  const hint = element('p', 'fl-outline-hint', 'Plan your script here. Add an act for each part of the story, then a synopsis or sequences under it. None of it prints.');
  const dropLine = element('div', 'fl-outline-drop');
  dropLine.hidden = true;
  const ghost = element('div', 'fl-outline-ghost');
  ghost.hidden = true;
  ghost.setAttribute('aria-hidden', 'true');

  const apply = ({ lines: next, focus = 'add' }) => {
    focusAfterRender = focus;
    edit(next);
  };

  const add = button({
    label: 'Add act',
    title: 'Add an act at the end of the script',
    icon: 'plus',
    iconOnly: true,
    cls: 'fl-outline-plus',
    onClick: () => apply(addOutlineHeader(lines)),
  });

  const root = element('section', 'fl-outline', hint, list, element('div', 'fl-outline-add', add), dropLine, ghost);
  root.setAttribute('aria-label', 'Outline');
  root.hidden = true;

  const scrollArea = () => root.parentElement;

  const fit = (field) => {
    field.style.height = 'auto';
    // scrollHeight leaves out any border, and the height includes it.
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  };

  const activeField = () => {
    const active = root.getRootNode().activeElement;
    return fields.find((entry) => entry.field === active) ?? null;
  };

  const focusField = ({ field }) => {
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  };

  // A move can leave every field in the same place, so it always redraws to keep the handle.
  const moveTo = (line, target) => {
    const result = moveOutlineBlock(lines, line, target);
    if (!result) return false;
    shape = null;
    handleAfterRender = result.focus;
    edit(result.lines);
    return true;
  };

  // Each press goes to the next place the block can be, whichever card that's in.
  const nudge = (item, down) => {
    const slots = outlineSlots(cards, lines.length, item.line);
    const slot = down
      ? slots.find((s) => s.line > item.end)
      : slots.findLast((s) => s.line < item.line);
    if (slot) moveTo(item.line, slot.line);
  };

  // Where each slot shows, measured once: nothing moves in the outline during a drag, and being
  // relative to the outline, these still hold while the area scrolls.
  const measureSlots = (line) => {
    const origin = root.getBoundingClientRect();
    return outlineSlots(cards, lines.length, line).map((slot) => {
      const wrapper = childNodes.get(slot.parent).getBoundingClientRect();
      const y = slot.before === null
        ? wrapper.bottom + 3
        : blockNodes.get(slot.before).getBoundingClientRect().top - 3;
      return { ...slot, y: y - origin.top, left: wrapper.left - origin.left, width: wrapper.width };
    });
  };

  const trackPointer = () => {
    const origin = root.getBoundingClientRect();
    const y = drag.pointerY - origin.top;
    drag.slot = drag.slots.reduce((best, slot) => (Math.abs(slot.y - y) < Math.abs(best.y - y) ? slot : best), drag.slots[0]);
    if (drag.slot) {
      dropLine.hidden = false;
      dropLine.style.top = `${drag.slot.y}px`;
      dropLine.style.left = `${drag.slot.left}px`;
      dropLine.style.width = `${drag.slot.width}px`;
    }
    // Below the pointer, so that it never covers the line showing where the block will land.
    const top = Math.min(y + GHOST_OFFSET_PX, root.offsetHeight - ghost.offsetHeight);
    ghost.style.top = `${Math.max(0, top)}px`;
  };

  // The bars float over the top and bottom of the area, so scrolling starts clear of them.
  const autoScroll = () => {
    if (!drag?.active) return;
    const area = scrollArea();
    const bounds = area.getBoundingClientRect();
    const bars = getComputedStyle(area);
    const top = bounds.top + parseFloat(bars.scrollPaddingTop || 0) + SCROLL_EDGE_PX;
    const bottom = bounds.bottom - parseFloat(bars.scrollPaddingBottom || 0) - SCROLL_EDGE_PX;
    if (drag.pointerY < top) area.scrollTop -= SCROLL_SPEED_PX;
    else if (drag.pointerY > bottom) area.scrollTop += SCROLL_SPEED_PX;
    trackPointer();
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const endDrag = () => {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    window.removeEventListener('keydown', drag.onKey, true);
    blockNodes.get(drag.item.line)?.classList.remove('fl-outline-dragging');
    dropLine.hidden = true;
    ghost.hidden = true;
    drag = null;
  };

  const beginDrag = () => {
    drag.active = true;
    drag.slots = measureSlots(drag.item.line);
    blockNodes.get(drag.item.line).classList.add('fl-outline-dragging');
    const text = element('span', '', drag.label);
    ghost.replaceChildren(icon(iconFor(drag.item)), text);
    ghost.hidden = false;
    autoScroll();
  };

  const handleFor = (entry, name) => {
    const handle = button({
      label: `Move ${name}`,
      title: `Drag to move${name === 'synopsis' ? '' : ', with everything under it'}. The arrow keys move it too.`,
      icon: 'grip',
      iconOnly: true,
      cls: 'fl-outline-grip',
    });
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      nudge(entry.item, event.key === 'ArrowDown');
    });
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      handle.setPointerCapture(event.pointerId);
      const onKey = (key) => {
        if (key.key !== 'Escape') return;
        key.stopPropagation();
        endDrag();
      };
      window.addEventListener('keydown', onKey, true);
      drag = { item: entry.item, label: entry.field?.value || entry.item.text || name, startY: event.clientY, pointerY: event.clientY, active: false, slots: [], slot: null, onKey, frame: 0 };
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      drag.pointerY = event.clientY;
      if (drag.active) trackPointer();
      else if (Math.abs(event.clientY - drag.startY) >= DRAG_THRESHOLD_PX) beginDrag();
    });
    const release = (drop) => () => {
      if (!drag) return;
      const { item, slot, active } = drag;
      endDrag();
      if (drop && active && slot) moveTo(item.line, slot.line);
    };
    handle.addEventListener('pointerup', release(true));
    handle.addEventListener('pointercancel', release(false));
    handles.set(entry.item.line, handle);
    return handle;
  };

  const fieldFor = (item, label, { cls = 'fl-outline-field', placeholder = label, clean = (text) => text, write = setOutlineText } = {}) => {
    const field = document.createElement('textarea');
    field.className = cls;
    field.rows = 1;
    field.value = item.text;
    field.placeholder = placeholder;
    field.setAttribute('aria-label', label);
    const entry = { field, item };
    field.addEventListener('input', () => {
      const cleaned = clean(field.value);
      if (cleaned !== field.value) field.value = cleaned;
      fit(field);
      typing = true;
      edit(write(lines, entry.item.line, field.value), { typing: true });
      typing = false;
    });
    // Enter moves on rather than breaking the line, since a Fountain line can't hold a break.
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      const next = fields[fields.indexOf(entry) + 1];
      if (next) focusField(next);
      else add.focus();
    });
    fields.push(entry);
    return entry;
  };

  const removeButton = (options) => button({ ...options, icon: 'close', iconOnly: true, cls: 'fl-outline-remove' });

  const buildBlock = (block) => {
    const entry = { item: block, field: null };
    const lines = block.lines.map((line) => {
      const row = element(
        'div',
        `fl-outline-line fl-outline-${line.kind}`,
        element('span', `fl-outline-block-text${line.forced ? ' fl-outline-forced' : ''}`, line.text),
      );
      if (line.kind === 'scene') {
        row.append(fieldFor({ line: line.line, text: line.number }, 'Scene number', {
          cls: 'fl-outline-number',
          placeholder: '12A',
          clean: cleanSceneNumber,
          write: setOutlineSceneNumber,
        }).field);
      }
      return row;
    });
    const node = element('div', 'fl-outline-block', handleFor(entry, block.scene ? 'scene' : 'transition'), kindIcon('scene'), element('div', 'fl-outline-lines', ...lines));
    blockNodes.set(block.line, node);
    return node;
  };

  const buildCard = (card) => {
    const top = card.level === 1;
    const name = levelName(card.level);
    const header = fieldFor(card, capitalized(name));
    const node = element('article', 'fl-outline-card', element(
      'div',
      'fl-outline-row fl-outline-heading',
      handleFor(header, name),
      kindIcon(iconFor(card)),
      header.field,
      removeButton({
        label: `Remove ${name}`,
        title: `Remove this ${top ? 'act and its sequences' : name} from the script. Scenes stay, and so do synopses, out of the outline.`,
        onClick: () => apply({ lines: removeOutlineCard(lines, header.item.line) }),
      }),
    ));
    blockNodes.set(card.line, node);

    const children = element('div', 'fl-outline-children', ...card.children.map(buildItem));
    childNodes.set(card.line, children);
    node.append(children);

    // A new synopsis goes with any already at the top. The rest follow what the card holds.
    let synopsisAt = card.line + 1;
    for (const kid of card.children) {
      if (kid.kind !== 'synopsis') break;
      synopsisAt = kid.line + 1;
    }
    const actions = [button({
      label: 'Add synopsis',
      title: `Add a synopsis to this ${name}`,
      icon: 'synopsis',
      text: 'Synopsis',
      cls: 'fl-btn-outline',
      onClick: () => apply(addOutlineSynopsis(lines, synopsisAt)),
    })];
    if (top) {
      actions.push(button({
        label: 'Add sequence',
        title: 'Add a sequence to this act',
        icon: 'sequence',
        text: 'Sequence',
        cls: 'fl-btn-outline',
        onClick: () => apply(addOutlineSubheader(lines, card.end)),
      }));
    }
    // The main + already adds an act after the last one.
    if (top && card.end < lines.length) {
      actions.push(button({
        label: 'Add act after this one',
        icon: 'act',
        text: 'Act',
        cls: 'fl-btn-outline',
        onClick: () => apply(addOutlineSubheader(lines, card.end, 1)),
      }));
    }
    node.append(element('div', 'fl-outline-actions', ...actions));
    return node;
  };

  const buildSynopsis = (synopsis) => {
    const entry = fieldFor(synopsis, 'Synopsis');
    const node = element('div', 'fl-outline-row fl-outline-synopsis', handleFor(entry, 'synopsis'), entry.field, removeButton({
      label: 'Remove synopsis',
      title: 'Delete this synopsis from the script',
      onClick: () => apply({ lines: removeOutlineSynopsis(lines, entry.item.line) }),
    }));
    blockNodes.set(synopsis.line, node);
    return node;
  };

  function buildItem(item) {
    if (item.kind === 'section') return buildCard(item);
    return item.kind === 'synopsis' ? buildSynopsis(item) : buildBlock(item);
  }

  // Redrawing would lose the cursor, so while the fields stay the same they're updated in place.
  const render = (value) => {
    cards = outlineCards(parse(value));
    lines = value.split('\n');
    const nextShape = shapeOf(cards);
    const active = activeField();

    if (nextShape === shape) {
      fieldItems(cards).forEach((item, i) => {
        const entry = fields[i];
        entry.item = item;
        // A typed trailing space isn't part of the card's text until the next word comes.
        if (entry.field.value !== item.text && !(typing && entry === active)) {
          entry.field.value = item.text;
          fit(entry.field);
        }
      });
    } else {
      endDrag();
      const activeLine = active?.item.line;
      fields = [];
      handles = new Map();
      blockNodes = new Map();
      childNodes = new Map([[null, list]]);
      shape = nextShape;
      list.replaceChildren(...cards.map(buildItem));
      hint.hidden = cards.length > 0;
      for (const { field } of fields) fit(field);
      const target = fields.find(({ item }) => item.line === (focusAfterRender ?? activeLine));
      if (handleAfterRender !== null) handles.get(handleAfterRender)?.focus();
      else if (target) focusField(target);
      else if (focusAfterRender !== null || active) add.focus();
    }
    focusAfterRender = null;
    handleAfterRender = null;
  };

  // One history for both tabs, rather than each text box keeping its own.
  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    if (key === 'y' || event.shiftKey) redo();
    else undo();
  });

  // Wrapping changes with the width.
  const resize = new ResizeObserver(() => {
    if (root.hidden) return;
    for (const { field } of fields) fit(field);
  });
  resize.observe(root);

  return {
    root,
    render,
    // Only moves focus into the outline when it's somewhere else.
    focus() {
      if (!root.contains(root.getRootNode().activeElement)) add.focus();
    },
    destroy() {
      endDrag();
      resize.disconnect();
      root.remove();
    },
  };
}
