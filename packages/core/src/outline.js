// Pure source edits behind the Outline tab, in the same shape as convert.js. Cards are a
// view of the script's # and ## lines. Scene cards show its scene headings and transitions,
// where only the scene number can change. Moving any of them carries the script text beneath
// it along.
//
// Every synopsis shows, wherever it sits. Like a sequence, it can come before the first act,
// and anything below an act is part of that act, just as it reads in the file.

import { parse } from './parser.js';

const isBlank = (text) => text === undefined || text.trim() === '';
const contentOf = (line) => (line.contentEnd > line.contentStart ? line.raw.slice(line.contentStart, line.contentEnd) : '');
const parsedLines = (lines) => parse(lines.join('\n')).lines;
const commentsOn = (line) => line.comments.map((c) => line.raw.slice(c.start, c.end)).join(' ');

const isBlock = (parsed, i) => ['section', 'scene', 'transition', 'synopsis'].includes(parsed[i].type);

// The line after everything a header holds: its text, scenes and deeper headers.
function sectionEnd(parsed, line) {
  const { level } = parsed[line];
  for (let i = line + 1; i < parsed.length; i++) {
    if (parsed[i].type === 'section' && parsed[i].level <= level) return i;
  }
  return parsed.length;
}

// The line after what moves with a block. A synopsis is only ever its own line. A scene card
// holds a scene and a transition that are next to each other, in either order, and no more, so
// it runs up to the next synopsis, act or sequence, the next line of the same kind, or the line
// after its second one.
function blockEnd(parsed, line) {
  const { type } = parsed[line];
  if (type === 'section') return sectionEnd(parsed, line);
  if (type === 'synopsis') return line + 1;
  let paired = false;
  for (let i = line + 1; i < parsed.length; i++) {
    if (!isBlock(parsed, i)) continue;
    const next = parsed[i].type;
    if (next === 'section' || next === 'synopsis' || paired || next === type) return i;
    paired = true;
  }
  return parsed.length;
}

/**
 * What to show, in script order. Acts and sequences are { kind: 'section', line, end, level,
 * text, children }, synopses are { kind: 'synopsis', line, end, text }, and scene cards are
 * { kind: 'block', line, end, scene, text, lines: [{ kind, line, text, forced, number }] },
 * where `scene` says whether one holds a scene and `text` names the card.
 */
export function outlineCards({ lines }) {
  const root = { level: 0, children: [] };
  const stack = [root];
  lines.forEach((l, i) => {
    if (!isBlock(lines, i)) return;
    const { children } = stack[stack.length - 1];
    if (l.type === 'synopsis') {
      children.push({ kind: 'synopsis', line: i, end: i + 1, text: contentOf(l) });
    } else if (l.type === 'section') {
      while (stack[stack.length - 1].level >= l.level) stack.pop();
      const card = { kind: 'section', line: i, end: blockEnd(lines, i), level: l.level, text: contentOf(l), children: [] };
      stack[stack.length - 1].children.push(card);
      stack.push(card);
    } else {
      let card = children[children.length - 1];
      if (card?.kind !== 'block' || card.lines.length > 1 || card.lines[0].kind === l.type) {
        card = { kind: 'block', line: i, end: blockEnd(lines, i), scene: false, text: l.text.trim(), lines: [] };
        children.push(card);
      }
      card.lines.push({ kind: l.type, line: i, text: l.text.trim(), forced: !!l.forced, number: l.sceneNumber ?? '' });
      if (l.type === 'scene') {
        card.scene = true;
        card.text = l.text.trim();
      }
    }
  });
  return root.children;
}

/**
 * Where a block can go, in script order, as { line, before, parent }: the line to insert at,
 * and the block it lands above and the header it lands in, or null for the end and the top
 * level. `moving` is the line of a block already there, or { kind, level } for a new one.
 *
 * Script text belongs to the header above it, so a scene or synopsis below a sequence is part
 * of that sequence, and its place at the bottom of an act is the end of the act's last one.
 * The top level is whatever comes before the first act. An act or sequence can go above scenes
 * and synopses, which then become part of it, and only sits inside headers of a higher level.
 */
export function outlineSlots(cards, total, moving) {
  const find = (list) => {
    for (const item of list) {
      if (item.line === moving) return item;
      const inner = item.children && find(item.children);
      if (inner) return inner;
    }
    return null;
  };
  const existing = typeof moving === 'number';
  const { kind, level } = existing ? find(cards) : moving;
  // Headers this deep or deeper can't hold it, and one higher than it ends where it can go.
  const limit = kind === 'section' ? level : Infinity;
  const slots = [];
  const walk = (children, parent, parentLevel, end) => {
    const items = existing ? children.filter((item) => item.line !== moving) : children;
    if (parentLevel < limit) {
      let closed = false;
      for (const item of items) {
        slots.push({ line: item.line, before: item.line, parent });
        if (item.kind === 'section' && item.level < limit) {
          closed = true;
          break;
        }
      }
      if (!closed) slots.push({ line: end, before: null, parent });
    }
    for (const item of items) if (item.kind === 'section' && item.level < limit) walk(item.children, item.line, item.level, item.end);
  };
  walk(cards, null, 0, total);
  return slots.sort((a, b) => a.line - b.line);
}

const splitsComment = (comments, at) => comments.some((c) => c.lineStart < at && c.lineEnd >= at);

// The written part of lines [a, b), without the blank lines at either end.
function trimmed(input, a, b, { start = true, end = true } = {}) {
  while (start && a < b && isBlank(input[a])) a++;
  while (end && b > a && isBlank(input[b - 1])) b--;
  return [a, b];
}

// A synopsis joins the line above it, unless that's the title page, which it would look part of.
const joins = (parsed, line, above) => parsed[line].type === 'synopsis' && parsed[above]?.type !== 'title';

/**
 * Moves a block and all it holds so that it lands before line `target`. Exactly one blank line
 * ends up between blocks, which is what scene headings and transitions need to stay what they
 * are, except that a synopsis joins whatever is now above it. Returns { lines, focus }, its new
 * line, or null if this wouldn't change anything.
 */
export function moveOutlineBlock(input, line, requested) {
  const { lines: parsed, comments } = parse(input.join('\n'));
  const end = blockEnd(parsed, line);
  const target = parsed[line].type === 'synopsis' ? insertionPoint(parsed, requested) : requested;
  if (target >= line && target <= end) return null;
  if ([line, end, target].some((at) => splitsComment(comments, at))) return null;

  const moved = trimmed(input, line, end);
  const parts = target < line
    ? [trimmed(input, 0, target, { start: false }), moved, trimmed(input, target, line), trimmed(input, end, input.length, { end: false })]
    : [trimmed(input, 0, line, { start: false }), trimmed(input, end, target), moved, trimmed(input, target, input.length, { end: false })];

  const lines = [];
  let focus = 0;
  let last = -1;
  for (const part of parts) {
    const [a, b] = part;
    if (a === b) continue;
    if (lines.length && !joins(parsed, a, last)) lines.push('');
    if (part === moved) focus = lines.length;
    lines.push(...input.slice(a, b));
    last = b - 1;
  }
  return { lines, focus };
}

/** What a scene number can hold, since anything else would stop it being read as one. */
export const cleanSceneNumber = (text) => text.replace(/[^\w.-]/g, '');

/** Sets, changes or, when empty, clears a scene heading's number. */
export function setOutlineSceneNumber(input, line, text) {
  const lines = [...input];
  const l = parsedLines(lines)[line];
  const number = cleanSceneNumber(text);
  const [start, end] = l.sceneNumberRange ?? [l.contentEnd, l.contentEnd];
  const before = l.raw.slice(0, start).trimEnd();
  lines[line] = `${before}${number ? ` #${number}#` : ''}${l.raw.slice(end)}`;
  return lines;
}

// Where text arriving before `target` really goes: after the last thing written above it.
function insertionPoint(parsed, target) {
  let at = target;
  while (at > 0 && parsed[at - 1].type === 'blank') at--;
  return at;
}

// An empty script is one blank line, which what's added replaces.
const startFrom = (input) => (input.length === 1 && input[0] === '' ? [] : [...input]);

/**
 * Adds an act (level 1) or sequence (level 2) before line `target`, the end by default, with
 * blank lines around it. Returns { lines, focus }, the new line.
 */
export function addOutlineSection(input, level = 1, target = input.length) {
  const lines = startFrom(input);
  const parsed = parsedLines(lines);
  const at = insertionPoint(parsed, Math.min(target, lines.length));
  const added = at > 0 ? ['', '#'.repeat(level)] : ['#'.repeat(level)];
  // A synopsis below stays joined, now to the new header.
  if (at < lines.length && !isBlank(lines[at]) && parsed[at].type !== 'synopsis') added.push('');
  lines.splice(at, 0, ...added);
  return { lines, focus: at + added.indexOf('#'.repeat(level)) };
}

/**
 * Adds a synopsis before line `target`, the end by default, joined to whatever is written above
 * it unless that's the title page. Returns { lines, focus }, the new line.
 */
export function addOutlineSynopsis(input, target = input.length) {
  const lines = startFrom(input);
  const parsed = parsedLines(lines);
  const at = insertionPoint(parsed, Math.min(target, lines.length));
  const added = at > 0 && parsed[at - 1].type === 'title' ? ['', '='] : ['='];
  // A scene heading or transition below needs the blank line above it.
  if (at < lines.length && !isBlank(lines[at]) && parsed[at].type !== 'synopsis') added.push('');
  lines.splice(at, 0, ...added);
  return { lines, focus: at + added.indexOf('=') };
}

/** Rewrites a card's text, keeping the marker and any comment at the end of the line. */
export function setOutlineText(input, line, text) {
  const lines = [...input];
  const l = parsedLines(lines)[line];
  const marker = l.type === 'section' ? l.level : 1;
  const head = l.raw.slice(0, l.prefix[0][0] + marker);
  const note = l.raw.slice(Math.max(l.contentStart, l.contentEnd)).trim();
  lines[line] = [head, text.replace(/\s*\n\s*/g, ' '), note].filter(Boolean).join(' ');
  return lines;
}

// Takes a header out without joining what's on either side of it. Comments on it stay,
// because a comment can run on to later lines and would otherwise lose its opening.
function removeHeaderLine(lines, parsedLine) {
  const i = parsedLine.index;
  if (parsedLine.comments.length) lines[i] = commentsOn(parsedLine);
  else if (i > 0 && !isBlank(lines[i - 1])) lines[i] = '';
  else lines.splice(i, i + 1 < lines.length && isBlank(lines[i + 1]) ? 2 : 1);
}

/** Removes a header and the deeper headers it holds, and nothing else. */
export function removeOutlineCard(input, line) {
  const lines = [...input];
  const parsed = parsedLines(lines);
  for (let i = sectionEnd(parsed, line) - 1; i >= line; i--) {
    if (parsed[i].type === 'section') removeHeaderLine(lines, parsed[i]);
  }
  return lines.length ? lines : [''];
}

/** Removes one synopsis, which is what its own remove button asks for. */
export function removeOutlineSynopsis(input, line) {
  const lines = [...input];
  const parsed = parsedLines(lines);
  if (parsed[line].comments.length) lines[line] = commentsOn(parsed[line]);
  // What's below shouldn't join what's above, unless it's another synopsis.
  else if (!isBlank(lines[line + 1]) && parsed[line + 1].type !== 'synopsis') lines[line] = '';
  else lines.splice(line, 1);
  return lines.length ? lines : [''];
}
