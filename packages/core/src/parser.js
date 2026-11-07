// Line-oriented Fountain parser (https://fountain.io/syntax).
// Every source line gets exactly one classified entry with raw-text offsets, so
// the same result drives editor decorations, read-only rendering and the layout
// engine. Nothing here mutates or re-serializes the source.

import { parseInline } from './inline.js';
import { findSettings, readSettings } from './settings.js';

export const SCENE_RE = /^(?:int\.?\/ext|i\/e|int|ext|est)[. ]/i;
const TITLE_KEYS = new Set(['title', 'credit', 'author', 'authors', 'source', 'draft date', 'date', 'contact', 'copyright', 'notes', 'revision']);
const MASK = '\0';
// A title page value's indent: two or more spaces or a tab, whatever else follows them.
export const TITLE_INDENT = /^(?: {2}|\t)[ \t]*/;

function findComments(src) {
  const comments = [];
  let i = 0;
  while (i < src.length) {
    const bone = src.indexOf('/*', i);
    const note = src.indexOf('[[', i);
    if (bone < 0 && note < 0) break;
    const isBone = bone >= 0 && (note < 0 || bone < note);
    const start = isBone ? bone : note;
    const end = src.indexOf(isBone ? '*/' : ']]', start + 2);
    // Unclosed comments stay literal so a half-typed "[[" can't swallow the script.
    // A note also can't cross a truly empty line; two spaces keep it open (per spec).
    if (end < 0 || (!isBone && /\n[ \t]?\n/.test(src.slice(start, end)))) {
      i = start + 2;
      continue;
    }
    comments.push({ type: isBone ? 'boneyard' : 'note', start, end: end + 2, text: src.slice(start + 2, end).trim() });
    i = end + 2;
  }
  return comments;
}

function isUpperName(s) {
  const name = s.replace(/\(.*?\)/g, '').replace(/\^\s*$/, '').trim();
  return /\p{L}/u.test(name) && name === name.toUpperCase();
}

const firstReal = (m) => m.search(/[^\s\0]/);
function lastReal(m) {
  for (let i = m.length - 1; i >= 0; i--) if (!/[\s\0]/.test(m[i])) return i + 1;
  return 0;
}

function finishScene(l) {
  const num = /#([\w.-]+)#[\s\0]*$/.exec(l.masked);
  if (!num) return;
  l.sceneNumber = num[1];
  l.sceneNumberRange = [num.index, num.index + num[1].length + 2];
  let end = num.index;
  while (end > l.contentStart && /\s/.test(l.masked[end - 1])) end--;
  l.contentEnd = end;
}

function finishCharacter(l, ctx) {
  ctx.inDialogue = true;
  const caret = /\^[\s\0]*$/.exec(l.masked);
  if (!caret) return;
  l.dual = true;
  let end = caret.index;
  while (end > l.contentStart && /\s/.test(l.masked[end - 1])) end--;
  l.prefix.push([end, caret.index + 1]);
  l.contentEnd = end;
}

function classifyBody(l, ctx) {
  const m = l.masked;
  const s = l.visible.trim();
  const lead = firstReal(m);
  const tail = lastReal(m);
  l.contentStart = lead;
  l.contentEnd = tail;
  const prefix = (n) => {
    l.prefix.push([lead, lead + n]);
    l.contentStart = lead + n;
  };
  const skipSpaces = () => {
    while (m[l.contentStart] === ' ' || m[l.contentStart] === '\t') l.contentStart++;
    l.prefix[l.prefix.length - 1][1] = l.contentStart;
  };

  if (/^={3,}$/.test(s)) { l.type = 'page-break'; prefix(tail - lead); ctx.inDialogue = false; return; }
  if (s[0] === '#') {
    l.type = 'section';
    l.level = /^#+/.exec(s)[0].length;
    prefix(l.level);
    skipSpaces();
    ctx.inDialogue = false;
    return;
  }
  if (s[0] === '=') { l.type = 'synopsis'; prefix(1); skipSpaces(); ctx.inDialogue = false; return; }

  if (ctx.inDialogue) {
    if (s[0] === '~') { l.type = 'lyrics'; l.inDialogue = true; prefix(1); return; }
    l.type = /^\(.*\)$/.test(s) ? 'parenthetical' : 'dialogue';
    return;
  }
  if (s[0] === '!') { l.type = 'action'; l.forced = true; prefix(1); return; }
  if (s[0] === '@') { l.type = 'character'; l.forced = true; prefix(1); finishCharacter(l, ctx); return; }
  if (s[0] === '~') { l.type = 'lyrics'; prefix(1); return; }
  if (s === '.' || /^\.[\p{L}\p{N}]/u.test(s)) { l.type = 'scene'; l.forced = true; prefix(1); finishScene(l); return; }
  if (s.length > 1 && s[0] === '>' && s.endsWith('<')) {
    l.type = 'centered';
    prefix(1);
    skipSpaces();
    let end = tail - 1;
    while (end > l.contentStart && /\s/.test(m[end - 1])) end--;
    l.prefix.push([end, tail]);
    l.contentEnd = end;
    return;
  }
  if (s[0] === '>') { l.type = 'transition'; l.forced = true; prefix(1); skipSpaces(); return; }
  if (SCENE_RE.test(s) && ctx.prevBlank && ctx.nextBlank) { l.type = 'scene'; finishScene(l); return; }
  // Any all-caps line ending in a colon, alone between blank lines, is a transition (CUT TO:,
  // SMASH CUT:, BACK TO SCENE:). It needs a letter, so 10: stays action. Trailing spaces
  // deliberately opt out of a transition match (per spec).
  if (l.visible.endsWith(':') && s === s.toUpperCase() && /\p{Lu}/u.test(s) && ctx.prevBlank && ctx.nextBlank) { l.type = 'transition'; return; }
  if (ctx.prevBlank && !ctx.nextBlank && isUpperName(s)) { l.type = 'character'; finishCharacter(l, ctx); return; }
  l.type = 'action';
  l.contentStart = 0; // action keeps its indentation
}

function buildOutline(lines) {
  const root = { type: 'root', level: 0, children: [] };
  const stack = [root];
  let lastScene = null;
  for (const l of lines) {
    if (l.type === 'section') {
      while (stack[stack.length - 1].level >= l.level) stack.pop();
      const node = { type: 'section', level: l.level, title: l.text.trim(), line: l.index, synopses: [], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      lastScene = null;
    } else if (l.type === 'scene') {
      lastScene = { type: 'scene', title: l.text.trim(), number: l.sceneNumber ?? null, line: l.index, synopses: [] };
      stack[stack.length - 1].children.push(lastScene);
    } else if (l.type === 'synopsis') {
      (lastScene ?? stack[stack.length - 1]).synopses?.push(l.text.trim());
    }
  }
  return root.children;
}

export function parse(input) {
  const source = String(input ?? '').replace(/\r\n?/g, '\n');
  const comments = findComments(source);
  const lines = [];
  let offset = 0;
  for (const raw of source.split('\n')) {
    lines.push({ index: lines.length, raw, masked: raw, start: offset, type: 'action', prefix: [], comments: [] });
    offset += raw.length + 1;
  }

  // Mask comment text so classification and emphasis never see inside it.
  let lineIdx = 0;
  comments.forEach((c, id) => {
    c.id = id;
    while (lines[lineIdx].start + lines[lineIdx].raw.length < c.start) lineIdx++;
    c.lineStart = lineIdx;
    let j = lineIdx;
    for (;;) {
      const l = lines[j];
      const a = Math.max(c.start - l.start, 0);
      const b = Math.min(c.end - l.start, l.raw.length);
      l.comments.push({ comment: c, start: a, end: b });
      l.masked = l.masked.slice(0, a) + MASK.repeat(b - a) + l.masked.slice(b);
      if (c.end <= l.start + l.raw.length) break;
      j++;
    }
    c.lineEnd = j;
  });
  for (const l of lines) {
    l.visible = l.masked.replaceAll(MASK, '');
    l.commentOnly = l.comments.length > 0 && l.visible.trim() === '';
    l.blank = !l.commentOnly && l.visible.trim() === '';
  }

  const prevBlank = (i) => {
    let j = i - 1;
    while (j >= 0 && lines[j].commentOnly) j--;
    return j < 0 || lines[j].blank;
  };
  // A synopsis never prints, so like a comment it can't stop a scene heading or transition
  // from standing alone.
  const isSynopsisText = (line) => line.visible.trim()[0] === '=' && !/^={3,}$/.test(line.visible.trim());
  const nextBlank = (i) => {
    let j = i + 1;
    while (j < lines.length && (lines[j].commentOnly || isSynopsisText(lines[j]))) j++;
    return j >= lines.length || lines[j].blank;
  };

  // Title page: only at the very top, and only if it opens with a known key, so
  // that "FADE IN:" or "JOHN: hi" on line one don't become title metadata.
  const titlePage = [];
  let bodyStart = 0;
  const first = lines.findIndex((l) => !l.blank && !l.commentOnly);
  const keyRe = /^([^\s:][^:]*):[ \t]*/;
  const titleContinues = (j) => {
    const next = lines[j];
    return !next || next.blank || TITLE_INDENT.test(next.masked) || TITLE_KEYS.has(keyRe.exec(next.masked)?.[1].trim().toLowerCase());
  };
  if (first >= 0 && TITLE_KEYS.has(keyRe.exec(lines[first].visible)?.[1].trim().toLowerCase())) {
    let j = first;
    // The first value under a key sets the indent the rest of that key's values have to match.
    let fieldIndent = null;
    const fitsField = (text) => {
      const indent = TITLE_INDENT.exec(text)?.[0];
      return indent !== undefined && (fieldIndent === null || indent === fieldIndent);
    };
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.commentOnly) continue;
      // Indentation alone is a value still to be typed, as long as the title page goes on after it.
      if (l.blank && !(titlePage.length && fitsField(l.raw) && titleContinues(j + 1))) break;
      l.blank = false;
      const key = /^[ \t]/.test(l.masked) ? null : keyRe.exec(l.masked);
      if (key) {
        fieldIndent = null;
        l.titleKey = key[1].trim().toLowerCase();
        l.prefix.push([0, key[0].length]);
        l.contentStart = key[0].length;
        titlePage.push({ key: l.titleKey, label: key[1].trim(), lines: [j] });
      } else if (titlePage.length && fitsField(l.masked)) {
        if (l.visible.trim()) fieldIndent = TITLE_INDENT.exec(l.masked)[0];
        l.titleKey = titlePage[titlePage.length - 1].key;
        l.contentStart = firstReal(l.masked) < 0 ? l.raw.length : firstReal(l.masked);
        l.prefix.push([0, l.contentStart]);
        titlePage[titlePage.length - 1].lines.push(j);
      } else {
        break;
      }
      l.type = 'title';
      l.contentEnd = lastReal(l.masked);
    }
    bodyStart = j;
  }

  const ctx = { inDialogue: false, prevBlank: true, nextBlank: true };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.commentOnly) { l.type = 'comment'; continue; }
    if (l.blank) {
      // Two spaces inside dialogue is an intentional empty dialogue line.
      if (ctx.inDialogue && /^ {2,}$/.test(l.raw) && !nextBlank(i)) { l.type = 'dialogue'; continue; }
      l.type = 'blank';
      ctx.inDialogue = false;
      continue;
    }
    if (i < bodyStart) continue;
    ctx.prevBlank = prevBlank(i);
    ctx.nextBlank = nextBlank(i);
    classifyBody(l, ctx);
  }

  for (const l of lines) {
    l.markers = [...l.prefix];
    l.runs = [];
    l.spans = [];
    // Hide leading indentation everywhere but action (spec: ignored for the rest).
    const lead = firstReal(l.masked);
    if (lead > 0 && l.type !== 'action' && !l.prefix.some(([a]) => a === 0)) l.markers.push([0, lead]);
    if (l.contentEnd > l.contentStart) {
      const inline = parseInline(l.masked, l.contentStart, l.contentEnd);
      l.markers.push(...inline.markers);
      l.spans = inline.spans;
      for (const { start: runStart, end: runEnd, ...flags } of inline.runs) {
        // Split runs around comments so rendered text excludes them.
        const re = /[^\0]+/g;
        const slice = l.masked.slice(runStart, runEnd);
        let hit;
        while ((hit = re.exec(slice))) {
          const start = runStart + hit.index;
          l.runs.push({ ...flags, start, end: start + hit[0].length, text: hit[0] });
        }
      }
    }
    l.text = l.runs.map((r) => r.text).join('');
    if (l.type === 'character') l.name = l.text.replace(/\s*\(.*?\)/g, '').trim();
  }

  const settingsBlock = findSettings(comments, source);
  return { source, lines, comments, titlePage, settingsBlock, settings: readSettings(settingsBlock), outline: buildOutline(lines) };
}

/** The script's title on one line, with a title on several lines joined by the separator. */
export function scriptTitle({ lines, titlePage }, separator = ' \u00b7 ') {
  const entry = titlePage.find((e) => e.key === 'title');
  return entry ? entry.lines.map((i) => lines[i].text.trim()).filter(Boolean).join(separator) : '';
}
