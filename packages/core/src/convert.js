// Pure source edits behind the ribbon: changing a line's Fountain type and
// toggling emphasis. They return new text and cursor positions, so they're
// testable without a browser and any future front end can reuse them.

import { parse, SCENE_RE, TITLE_INDENT } from './parser.js';
import { parseInline } from './inline.js';

const inDialogue = (l) => !!l && (l.type === 'character' || l.type === 'parenthetical' || l.type === 'dialogue' || (l.type === 'lyrics' && l.inDialogue));

export function lineTypeKey(line) {
  if (line.type === 'section') return `section-${Math.min(line.level, 3)}`;
  if (line.type === 'comment') return line.comments[0].comment.type;
  return line.type;
}

function bareText(line) {
  let out = '';
  let pos = 0;
  for (const [a, b] of [...line.prefix].sort((x, y) => x[0] - y[0])) {
    out += line.raw.slice(pos, a);
    pos = b;
  }
  out += line.raw.slice(pos);
  out = out.trim();
  if (line.type === 'parenthetical') out = out.replace(/^\((.*)\)$/, '$1');
  if (line.type === 'comment') out = out.replace(/^(?:\[\[(.*)\]\]|\/\*(.*)\*\/)$/, '$1$2').trim();
  return out;
}

// Uppercases script text but leaves [[notes]] and /* boneyard */ as written.
const upper = (s) => s.split(/(\[\[.*?\]\]|\/\*.*?\*\/)/).map((p, i) => (i % 2 ? p : p.toUpperCase())).join('');

function convertLine(input, index, requested) {
  const lines = [...input];
  let i = index;
  const parsed = parse(lines.join('\n')).lines;
  const line = parsed[i];
  const type = lineTypeKey(line) === requested ? 'action' : requested;
  const bare = bareText(line);
  const isBlank = (n) => n < 0 || n >= lines.length || lines[n].trim() === '';
  const blankBefore = () => {
    if (!isBlank(i - 1)) { lines.splice(i, 0, ''); i++; }
  };
  const blankAfter = () => {
    if (i + 1 < lines.length && !isBlank(i + 1)) lines.splice(i + 1, 0, '');
  };
  let selection = null;

  // Dialogue only exists under a cue: reuse one just above, or add a placeholder.
  const ensureSpeaker = () => {
    if (inDialogue(parsed[i - 1])) return;
    // "BOB" typed just above an empty line only becomes a cue once this line has text.
    const above = parsed[i - 1];
    if (above && !above.blank && (i < 2 || parsed[i - 2].blank) && above.text === above.text.toUpperCase() && /\p{L}/u.test(above.text)) return;
    if (parsed[i - 1]?.type === 'blank' && inDialogue(parsed[i - 2])) {
      lines.splice(i - 1, 1);
      i--;
      return;
    }
    blankBefore();
    const name = 'CHARACTER';
    const cue = bare ? name : `@${name}`;
    lines.splice(i, 0, cue);
    selection = { line: i, from: cue.length - name.length, to: cue.length };
    i++;
  };

  let text = bare;
  let caretFromEnd = 0; // for when the cursor belongs inside closing markers
  switch (type) {
    case 'scene':
      text = SCENE_RE.test(bare) ? bare : bare ? `.${bare}` : 'INT. ';
      blankBefore();
      blankAfter();
      break;
    case 'action':
      if (inDialogue(parsed[i - 1])) blankBefore();
      break;
    case 'character': {
      blankBefore();
      const name = upper(bare);
      text = name && !isBlank(i + 1) ? name : `@${name}`;
      break;
    }
    case 'dialogue':
      ensureSpeaker();
      break;
    case 'parenthetical':
      ensureSpeaker();
      text = `(${bare})`;
      caretFromEnd = 1;
      break;
    case 'lyrics':
      text = `~${bare}`;
      break;
    case 'transition':
      blankBefore();
      blankAfter();
      text = `> ${upper(bare)}`;
      break;
    case 'centered':
      if (inDialogue(parsed[i - 1])) blankBefore();
      text = `> ${bare} <`;
      caretFromEnd = 2;
      break;
    case 'section-1':
    case 'section-2':
    case 'section-3':
      text = `${'#'.repeat(Number(type.at(-1)))} ${bare}`;
      break;
    case 'synopsis':
      text = `= ${bare}`;
      break;
    case 'note':
      text = `[[${bare}]]`;
      caretFromEnd = 2;
      break;
    default:
      throw new Error(`Unknown line type: ${type}`);
  }
  lines[i] = text;
  // Text that still reads as something else needs an explicit action marker.
  if (type === 'action' && bare && parse(lines.join('\n')).lines[i].type !== 'action') lines[i] = `!${bare}`;
  if (!selection) {
    const at = lines[i].length - caretFromEnd;
    selection = { line: i, from: at, to: at };
  }
  return { lines, delta: lines.length - input.length, index: i, cursor: selection };
}

export function applyLineType(input, from, to, type) {
  let lines = [...input];
  let cursor = { line: from, from: 0, to: 0 };
  // Conversions can insert blank lines on either side, so walk by how many of
  // the original lines remain rather than by a fixed end index.
  let i = from;
  for (let remaining = to - from; remaining >= 0; remaining--, i++) {
    if (from !== to && lines[i].trim() === '') continue;
    const r = convertLine(lines, i, type);
    lines = r.lines;
    cursor = r.cursor;
    i = r.index;
    // Step over a blank line this conversion added, which isn't one of the originals.
    if (remaining > 0 && lines[i + 1]?.trim() === '' && input[to - remaining + 1]?.trim() !== '') i++;
  }
  return { lines, cursor };
}

export function insertPageBreak(input, index) {
  const lines = [...input];
  const i = lines[index].trim() === '' ? index : index + 1;
  const block = ['===', ''];
  if (i > 0 && lines[i - 1].trim() !== '') block.unshift('');
  lines.splice(i, lines[i]?.trim() === '' ? 1 : 0, ...block);
  return { lines, cursor: { line: i + block.length - 1, from: 0, to: 0 } };
}

// Toggles the dual-dialogue caret on the character cue at or above this line.
// The character cue a line of a speech belongs to, or -1 outside of a speech.
function speakerOf(parsed, index) {
  let i = index;
  while (i >= 0 && parsed[i].type !== 'character') {
    if (!inDialogue(parsed[i])) return -1;
    i--;
  }
  return i;
}

/** Whether a line belongs to a speech marked as dual dialogue. Takes parsed lines. */
export function dualAt(parsed, index) {
  const speaker = speakerOf(parsed, index);
  return speaker >= 0 && !!parsed[speaker].dual;
}

export function toggleDual(input, index) {
  const parsed = parse(input.join('\n')).lines;
  const i = speakerOf(parsed, index);
  if (i < 0) return null;
  const lines = [...input];
  lines[i] = parsed[i].dual ? lines[i].replace(/\s*\^(\s*)$/, '$1') : `${lines[i].trimEnd()} ^`;
  return { lines, cursor: { line: i, from: lines[i].length, to: lines[i].length } };
}

function cursorAt(text, offset) {
  const before = text.slice(0, offset).split('\n');
  const at = before[before.length - 1].length;
  return { line: before.length - 1, from: at, to: at };
}

// Cuts text to the boneyard, or restores it if the selection touches a cut already.
// Works on the selection rather than whole lines, and can span several lines.
export function toggleBoneyard(input, fromLine, fromCh, toLine, toCh) {
  const { source, lines, comments } = parse(input.join('\n'));
  let start = lines[fromLine].start + fromCh;
  let end = lines[toLine].start + toCh;
  const hit = comments.find((c) => c.type === 'boneyard' && c.start <= end && start <= c.end);
  if (hit) {
    const inner = source.slice(hit.start + 2, hit.end - 2).replace(/^ /, '').replace(/ $/, '');
    const text = source.slice(0, hit.start) + inner + source.slice(hit.end);
    return { lines: text.split('\n'), cursor: cursorAt(text, hit.start + inner.length) };
  }
  // With nothing selected, cut the line the cursor is on.
  if (start === end) {
    start = lines[fromLine].start;
    end = start + lines[fromLine].raw.length;
  }
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;
  const middle = source.slice(start, end);
  const text = `${source.slice(0, start)}/* ${middle} */${source.slice(end)}`;
  return { lines: text.split('\n'), cursor: cursorAt(text, start + 3 + middle.length) };
}

const DELIM = { bold: '**', italic: '*', underline: '_' };
const maskNotes = (raw) => raw.replace(/\[\[.*?\]\]|\/\*.*?\*\//g, (m) => '\0'.repeat(m.length));

export function emphasisAt(raw, from, to, contentStart = 0, contentEnd = raw.length) {
  const { spans } = parseInline(maskNotes(raw), contentStart, contentEnd);
  const has = (style) => spans.some((s) => s[style] && s.openStart <= from && to <= s.closeEnd);
  return { bold: has('bold'), italic: has('italic'), underline: has('underline') };
}

// Returns the new line text and selection (offsets within the line).
export function toggleEmphasis(raw, from, to, style, contentStart = 0, contentEnd = raw.length) {
  const delim = DELIM[style];
  const n = delim.length;
  const { spans } = parseInline(maskNotes(raw), contentStart, contentEnd);
  const span = spans.find((s) => s[style] && s.openStart <= from && to <= s.closeEnd);
  if (span) {
    const text = raw.slice(0, span.openEnd - n) + raw.slice(span.openEnd, span.closeStart) + raw.slice(span.closeStart + n);
    const shift = (p) => {
      if (p >= span.closeStart + n) return p - 2 * n;
      if (p >= span.closeStart) return span.closeStart - n;
      if (p >= span.openEnd) return p - n;
      return Math.min(p, span.openEnd - n);
    };
    return { text, from: shift(from), to: shift(to) };
  }
  let a = Math.max(from, contentStart);
  let b = Math.max(a, Math.min(to, contentEnd));
  while (a < b && /\s/.test(raw[a])) a++;
  while (b > a && /\s/.test(raw[b - 1])) b--;
  const text = raw.slice(0, a) + delim + raw.slice(a, b) + delim + raw.slice(b);
  return { text, from: a + n, to: b + n };
}

/**
 * Enter on a title page field with its value on the lines below. On a key with nothing beside it
 * this starts the values. On a value it splits as usual but stays a value, and on one still empty
 * it stops, leaving a regular line. Returns { lines, cursor }, or null for anything else, such as
 * a value on the same line as its key, which Enter leaves as an ordinary line.
 */
export function continueTitleField(input, index, offset = input[index].length) {
  const parsed = parse(input.join('\n')).lines;
  const line = parsed[index];
  if (line.type !== 'title') return null;
  const indent = TITLE_INDENT.exec(line.raw)?.[0];
  const hasValue = line.contentEnd > line.contentStart;
  const lines = [...input];
  if (!indent) {
    if (hasValue || offset !== line.raw.length) return null;
    // A new value matches its own field if it can, then the rest of the title page.
    const indentOf = (l) => (l?.type === 'title' ? TITLE_INDENT.exec(l.raw)?.[0] : undefined);
    const next = indentOf(parsed[index + 1]) ?? parsed.map(indentOf).find(Boolean) ?? '    ';
    lines.splice(index + 1, 0, next);
    return { lines, cursor: { line: index + 1, from: next.length } };
  }
  if (!hasValue) {
    // A blank line would end the title page, so with more fields below, it just goes.
    if (parsed[index + 1]?.type === 'title') lines.splice(index, 1);
    else lines[index] = '';
    return { lines, cursor: { line: index, from: 0 } };
  }
  const at = Math.max(offset, line.contentStart);
  lines[index] = line.raw.slice(0, at).trimEnd() || indent;
  lines.splice(index + 1, 0, indent + line.raw.slice(at));
  return { lines, cursor: { line: index + 1, from: indent.length } };
}

/**
 * Backspace at the start of a value, where the indent is out of sight: joins it to the line above,
 * as if the indent weren't there. Returns { lines, cursor }.
 */
export function joinTitleValue(input, index) {
  const parsed = parse(input.join('\n')).lines;
  const line = parsed[index];
  const above = input[index - 1];
  const text = line.raw.slice(line.contentStart);
  const lines = [...input];
  const isBareKey = parsed[index - 1].contentEnd <= parsed[index - 1].contentStart && !TITLE_INDENT.test(above);
  const joined = `${above}${isBareKey && text && !above.endsWith(' ') ? ' ' : ''}${text}`;
  lines.splice(index - 1, 2, joined);
  return { lines, cursor: { line: index - 1, from: above.length + (joined.length - above.length - text.length) } };
}
