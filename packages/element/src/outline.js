// The Outline tab: the script's acts, sequences, scenes and transitions in order, as a column of cards
// and blocks. They hold nothing of their own. Each edit changes the script's text, and they're
// redrawn from it, so this and the Write tab can't disagree and they share one undo history.
//
// New acts, sequences and synopses come from tools in the action center. A click puts one below
// the selected card, or at the end with nothing selected, and a drag puts it where it's dropped.
// An act or sequence clicked in with a card inside an act or sequence selected splits it there.

import {
  cleanSceneNumber, setOutlineSceneNumber,
  addOutlineSection, addOutlineSynopsis, moveOutlineBlock, outlineCards,
  outlineSlots, parse, removeOutlineCard, removeOutlineSynopsis, setOutlineText,
} from '@flow/core';
import { button, icon, pill } from './controls.js';

// How far the pointer moves before a press becomes a drag. A finger wanders further during
// an ordinary tap than a mouse does during a click.
const DRAG_THRESHOLD_PX = { mouse: 4, touch: 12, pen: 12 };
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

// What each tool adds, in the terms outlineSlots places it by.
const TOOLS = [
  { name: 'act', spec: { kind: 'section', level: 1 } },
  { name: 'sequence', spec: { kind: 'section', level: 2 } },
  { name: 'synopsis', spec: { kind: 'synopsis' } },
];

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
  let itemsByLine = new Map();
  let selected = null;
  let suppressClick = false;
  let handles = new Map();
  let typing = false;
  let focusAfterRender = null;
  let handleAfterRender = null;
  let drag = null;

  const list = element('div', 'fl-outline-list');
  const hint = element(
    'div',
    'fl-outline-hint',
    element('p', 'fl-outline-hint-title', 'Outline your screenplay here.'),
    element('p', '', 'Click Act, Sequence or Synopsis above to add one, or drag it to where it belongs.'),
  );
  const dropLine = element('div', 'fl-outline-drop');
  dropLine.hidden = true;
  const ghost = element('div', 'fl-outline-ghost');
  ghost.hidden = true;
  ghost.setAttribute('aria-hidden', 'true');

  const apply = ({ lines: next, focus = 'add' }) => {
    focusAfterRender = focus;
    edit(next);
  };

  const root = element('section', 'fl-outline', hint, list, dropLine, ghost);
  root.setAttribute('aria-label', 'Outline');
  // Focus can rest on the outline itself, with no card selected.
  root.tabIndex = -1;
  root.hidden = true;

  const select = (line) => {
    if (selected !== null) blockNodes.get(selected)?.classList.remove('fl-outline-selected');
    selected = line !== null && blockNodes.has(line) ? line : null;
    if (selected !== null) blockNodes.get(selected).classList.add('fl-outline-selected');
  };

  // The innermost card or block holding a node inside the outline.
  const cardLineOf = (node) => {
    for (let at = node; at && at !== root; at = at.parentElement) {
      const line = at.dataset?.line;
      if (line !== undefined && blockNodes.get(Number(line)) === at) return Number(line);
    }
    return null;
  };

  // Below the selected card is the first place after it, past any synopses at its top so that a
  // new sequence doesn't take them over. With nothing selected, it's the end of the script.
  // The level of the header holding the block at `line`, or 0 at the top level.
  const parentLevelOf = (line) => {
    const walk = (items, level) => {
      for (const item of items) {
        if (item.line === line) return level;
        const inner = item.children ? walk(item.children, item.level) : null;
        if (inner !== null) return inner;
      }
      return null;
    };
    return walk(cards, 0) ?? 0;
  };

  // A new act or sequence can't sit inside a header of its own level or higher, so with
  // something inside one selected, it starts at that card and splits the header there: a
  // sequence B selected in an act holding A, B and C gets the new act between A and B.
  const placeFor = (spec) => {
    const slots = outlineSlots(cards, lines.length, spec);
    const item = selected === null ? null : itemsByLine.get(selected);
    if (!item) return slots[slots.length - 1].line;
    if (spec.kind === 'section' && spec.level <= parentLevelOf(item.line)) return item.line;
    let anchor = item.line;
    for (const child of item.children ?? []) {
      if (child.kind !== 'synopsis') break;
      anchor = child.line;
    }
    return (slots.find((slot) => slot.line > anchor) ?? slots[slots.length - 1]).line;
  };

  const create = (spec, at) => {
    apply(spec.kind === 'synopsis' ? addOutlineSynopsis(lines, at) : addOutlineSection(lines, spec.level, at));
  };

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
  const measureSlots = (moving) => {
    const origin = root.getBoundingClientRect();
    return outlineSlots(cards, lines.length, moving).map((slot) => {
      const wrapper = childNodes.get(slot.parent).getBoundingClientRect();
      const y = slot.before === null
        ? wrapper.bottom + 3
        : blockNodes.get(slot.before).getBoundingClientRect().top - 3;
      return { ...slot, y: y - origin.top, left: wrapper.left - origin.left, width: wrapper.width };
    });
  };

  // The part of the area between the bars, where a drop lands.
  const openArea = () => {
    const area = scrollArea();
    const bounds = area.getBoundingClientRect();
    const bars = getComputedStyle(area);
    return {
      top: bounds.top + parseFloat(bars.scrollPaddingTop || 0),
      bottom: bounds.bottom - parseFloat(bars.scrollPaddingBottom || 0),
    };
  };

  const trackPointer = () => {
    const origin = root.getBoundingClientRect();
    const y = drag.pointerY - origin.top;
    const open = openArea();
    // A new card still over the action center hasn't been brought to the outline yet.
    drag.inside = drag.pointerY >= open.top && drag.pointerY <= open.bottom;
    if (drag.inside) drag.entered = true;
    drag.slot = drag.item || drag.inside
      ? drag.slots.reduce((best, slot) => (Math.abs(slot.y - y) < Math.abs(best.y - y) ? slot : best), drag.slots[0])
      : null;
    dropLine.hidden = !drag.slot;
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
  // A new card only scrolls the area once it has been over the outline, not as it leaves the bar.
  const autoScroll = () => {
    if (!drag?.active) return;
    const area = scrollArea();
    const open = openArea();
    if (drag.item || drag.entered) {
      if (drag.pointerY < open.top + SCROLL_EDGE_PX) area.scrollTop -= SCROLL_SPEED_PX;
      else if (drag.pointerY > open.bottom - SCROLL_EDGE_PX) area.scrollTop += SCROLL_SPEED_PX;
    }
    trackPointer();
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const endDrag = () => {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    window.removeEventListener('keydown', drag.onKey, true);
    if (drag.item) blockNodes.get(drag.item.line)?.classList.remove('fl-outline-dragging');
    dropLine.hidden = true;
    ghost.hidden = true;
    drag = null;
  };

  const beginDrag = () => {
    drag.active = true;
    drag.slots = measureSlots(drag.item ? drag.item.line : drag.spec);
    if (drag.item) blockNodes.get(drag.item.line).classList.add('fl-outline-dragging');
    const text = element('span', '', drag.label);
    ghost.replaceChildren(icon(drag.icon), text);
    ghost.hidden = false;
    autoScroll();
  };

  // Dragging from `node`: a block that's there, given `item`, or a new one, given `spec`. The
  // pointer is captured, so the drag follows it out of the outline and back.
  const draggable = (node, start) => {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      node.setPointerCapture(event.pointerId);
      const onKey = (key) => {
        if (key.key !== 'Escape') return;
        key.stopPropagation();
        endDrag();
      };
      window.addEventListener('keydown', onKey, true);
      drag = { item: null, spec: null, ...start(), threshold: DRAG_THRESHOLD_PX[event.pointerType] ?? DRAG_THRESHOLD_PX.touch, startX: event.clientX, startY: event.clientY, pointerY: event.clientY, active: false, inside: false, entered: false, slots: [], slot: null, onKey, frame: 0 };
    });
    node.addEventListener('pointermove', (event) => {
      if (!drag) return;
      drag.pointerY = event.clientY;
      if (drag.active) trackPointer();
      else if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= drag.threshold) beginDrag();
    });
    const release = (drop) => () => {
      if (!drag) return;
      const { item, spec, slot, active } = drag;
      endDrag();
      // The click that follows a drag isn't another request to add.
      if (active) suppressClick = true;
      if (!drop || !active || !slot) return;
      if (item) moveTo(item.line, slot.line);
      else create(spec, slot.line);
    };
    node.addEventListener('pointerup', release(true));
    node.addEventListener('pointercancel', release(false));
  };

  const tools = TOOLS.map(({ name, spec }) => {
    const tool = button({
      label: `Add ${name}`,
      title: `Add ${name === 'act' ? 'an' : 'a'} ${name} below the selected card, or at the end. Drag it to place it.`,
      icon: name,
      text: capitalized(name),
      cls: 'fl-outline-tool',
      onClick: () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        create(spec, placeFor(spec));
      },
    });
    draggable(tool, () => ({ spec, icon: name, label: `New ${name}` }));
    return tool;
  });

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
    draggable(handle, () => ({ item: entry.item, icon: iconFor(entry.item), label: entry.field?.value || entry.item.text || name }));
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
      else tools[0].focus();
    });
    fields.push(entry);
    return entry;
  };

  const register = (item, node) => {
    node.dataset.line = item.line;
    blockNodes.set(item.line, node);
    itemsByLine.set(item.line, item);
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
    register(block, node);
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
    register(card, node);

    const children = element('div', 'fl-outline-children', ...card.children.map(buildItem));
    childNodes.set(card.line, children);
    node.append(children);
    return node;
  };

  const buildSynopsis = (synopsis) => {
    const entry = fieldFor(synopsis, 'Synopsis');
    const node = element('div', 'fl-outline-row fl-outline-synopsis', handleFor(entry, 'synopsis'), entry.field, removeButton({
      label: 'Remove synopsis',
      title: 'Delete this synopsis from the script',
      onClick: () => apply({ lines: removeOutlineSynopsis(lines, entry.item.line) }),
    }));
    register(synopsis, node);
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
      itemsByLine = new Map();
      selected = null;
      childNodes = new Map([[null, list]]);
      shape = nextShape;
      list.replaceChildren(...cards.map(buildItem));
      hint.hidden = cards.length > 0;
      for (const { field } of fields) fit(field);
      const target = fields.find(({ item }) => item.line === (focusAfterRender ?? activeLine));
      if (handleAfterRender !== null) handles.get(handleAfterRender)?.focus();
      else if (target) focusField(target);
      else if (focusAfterRender !== null || active) root.focus();
      // Whatever has focus now is the selected card, or nothing is.
      const focused = root.getRootNode().activeElement;
      select(root.contains(focused) ? cardLineOf(focused) : null);
    }
    focusAfterRender = null;
    handleAfterRender = null;
  };

  // A card is selected by focusing or pressing anywhere in it. Pressing between the cards, or
  // Escape, selects nothing.
  root.addEventListener('focusin', (event) => {
    const line = cardLineOf(event.target);
    if (line !== null) select(line);
  });
  root.addEventListener('pointerdown', (event) => {
    const line = cardLineOf(event.target);
    select(line);
    if (line === null) root.focus({ preventScroll: true });
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || selected === null || drag) return;
    select(null);
    root.focus({ preventScroll: true });
  });

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
    /** The pills this tab puts in the action center. */
    tools: tools.map((tool) => pill({ label: tool.getAttribute('aria-label') }, tool)),
    render,
    // Only moves focus into the outline when it's somewhere else.
    focus() {
      if (!root.contains(root.getRootNode().activeElement)) root.focus({ preventScroll: true });
    },
    destroy() {
      endDrag();
      resize.disconnect();
      root.remove();
    },
  };
}
