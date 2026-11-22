// The Vim lite engine: a small part of Vim's keys, read one at a time, working on the script
// through the editor's text API and nothing else. It keeps a mode, the command being typed, and a
// register for what was last deleted or copied. Each change it makes is one undo step.
//
// Normal mode moves and edits; Insert types as usual; Visual and Visual line select. What it
// knows is in MOTIONS, OPERATORS, normalKey and visualKey, and the README lists it too.

// Motions, by key: what they're called and what an operator takes with them. `inclusive` takes
// the character landed on; `linewise` takes whole lines; `wantsChar` reads one more key.
const MOTIONS = {
  h: { name: 'Left' },
  l: { name: 'Right' },
  j: { name: 'Down', linewise: true },
  k: { name: 'Up', linewise: true },
  '+': { name: 'Next line', linewise: true },
  '-': { name: 'Previous line', linewise: true },
  w: { name: 'Next word' },
  W: { name: 'Next WORD' },
  b: { name: 'Previous word' },
  B: { name: 'Previous WORD' },
  e: { name: 'End of word', inclusive: true },
  E: { name: 'End of WORD', inclusive: true },
  0: { name: 'Start of line' },
  '^': { name: 'First character' },
  $: { name: 'End of line', inclusive: true },
  gg: { name: 'First line', linewise: true },
  G: { name: 'Last line', linewise: true },
  f: { name: 'Find', inclusive: true, wantsChar: true },
  F: { name: 'Find back', wantsChar: true },
  t: { name: 'Till', inclusive: true, wantsChar: true },
  T: { name: 'Till back', wantsChar: true },
};

const OPERATORS = { d: 'Delete', c: 'Change', y: 'Copy' };
const LINE_NAMES = { d: 'Delete line', c: 'Change line', y: 'Copy line' };

// Keys that stand for others in Normal and Visual mode.
const KEY_ALIASES = {
  ArrowLeft: 'h', ArrowRight: 'l', ArrowDown: 'j', ArrowUp: 'k', Backspace: 'h', Enter: '+', Home: '0', End: '$', Delete: 'x',
};

export const MODE_LABELS = { normal: 'NORMAL', insert: 'INSERT', visual: 'VISUAL', 'visual-line': 'V-LINE' };

const CHORD_MS = 600;

const before = (a, b) => a.line < b.line || (a.line === b.line && a.ch < b.ch);
const ordered = (a, b) => (before(b, a) ? [b, a] : [a, b]);

// Words are runs of letters, digits and underscores, or runs of other marks; WORDs are anything
// but spaces. A line's end counts as space.
const classOf = (char, big) => {
  if (char === '\n' || /\s/.test(char)) return 0;
  if (big) return 1;
  return /\w/.test(char) ? 1 : 2;
};

/**
 * Starts an engine. `options()` gives { startMode, chord, blockCursor } as they are now, and
 * `onStatus({ mode, keys, pending, action })` hears what to show after every key: the mode, the
 * keys of the command typed or being typed, and what it did or is waiting for.
 */
export function createVim({ options, onStatus }) {
  let mode = options().startMode === 'insert' ? 'insert' : 'normal';
  let keys = ''; // the command so far, as typed
  let shownKeys = ''; // the last command, shown until the next key
  let action = '';
  let pending = { count: '', op: '', opCount: '', prefix: '' };
  let register = { text: '', linewise: false };
  let anchor = null; // where Visual mode started
  let cursor = null; // Visual mode's moving end; the other modes use the editor's own cursor
  let column = null; // the column j and k try to keep
  let lastInsert = { key: '', at: 0 };
  let text = null;

  const visual = () => mode === 'visual' || mode === 'visual-line';
  const status = () => onStatus({ mode, keys: keys || shownKeys, pending: !!keys, action });

  const caret = () => {
    text?.setCaret(mode !== 'insert' && options().blockCursor !== false ? 'block' : null);
  };

  // --- Reading the text ---

  const len = (line) => text.line(line).length;
  const lastLine = () => text.lineCount - 1;
  const charAt = ({ line, ch }) => (ch >= len(line) ? '\n' : text.line(line)[ch]);
  const clampNormal = ({ line, ch }) => ({ line, ch: Math.max(0, Math.min(ch, len(line) - 1)) });
  const firstNonBlank = (line) => Math.max(0, text.line(line).search(/\S|$/));
  const forward = ({ line, ch }) => (ch < len(line) ? { line, ch: ch + 1 } : line < lastLine() ? { line: line + 1, ch: 0 } : null);
  const backward = ({ line, ch }) => (ch > 0 ? { line, ch: ch - 1 } : line > 0 ? { line: line - 1, ch: len(line - 1) } : null);
  const linesOf = (a, b) => {
    const lines = [];
    for (let i = a; i <= b; i++) lines.push(text.line(i));
    return lines.join('\n');
  };
  const between = (from, to) => {
    const [a, b] = ordered(from, to);
    if (a.line === b.line) return text.line(a.line).slice(a.ch, b.ch);
    const middle = a.line + 1 <= b.line - 1 ? [linesOf(a.line + 1, b.line - 1)] : [];
    return [text.line(a.line).slice(a.ch), ...middle, text.line(b.line).slice(0, b.ch)].join('\n');
  };
  const here = () => (visual() ? cursor : text.cursor());

  // --- Motions ---

  function nextWord(pos, big) {
    let at = pos;
    const start = classOf(charAt(at), big);
    // Past the rest of this word, then the space after it. An empty line counts as a word.
    while (start && classOf(charAt(at), big) === start) {
      const next = forward(at);
      if (!next) return { line: at.line, ch: len(at.line) };
      at = next;
      if (at.ch === 0) break;
    }
    while (classOf(charAt(at), big) === 0) {
      if (len(at.line) === 0 && at.line !== pos.line) return at;
      const next = forward(at);
      if (!next) return at;
      at = next;
    }
    return at;
  }

  function wordEnd(pos, big) {
    let at = forward(pos) ?? pos;
    while (classOf(charAt(at), big) === 0) {
      const next = forward(at);
      if (!next) return at;
      at = next;
    }
    const kind = classOf(charAt(at), big);
    for (;;) {
      const next = forward(at);
      if (!next || next.line !== at.line || classOf(charAt(next), big) !== kind) return at;
      at = next;
    }
  }

  function previousWord(pos, big) {
    let at = backward(pos);
    if (!at) return pos;
    while (classOf(charAt(at), big) === 0) {
      if (len(at.line) === 0) return at;
      const next = backward(at);
      if (!next) return at;
      at = next;
    }
    const kind = classOf(charAt(at), big);
    for (;;) {
      const next = backward(at);
      if (!next || next.line !== at.line || classOf(charAt(next), big) !== kind) return at;
      at = next;
    }
  }

  // f and t look ahead along the line for the character, F and T back. t and T stop beside it.
  function find(pos, key, char, count) {
    const line = text.line(pos.line);
    const step = key === 'f' || key === 't' ? 1 : -1;
    const till = key === 't' || key === 'T';
    let ch = pos.ch;
    for (let n = 0; n < count; n++) {
      let at = ch + step * (till && n === 0 ? 2 : 1);
      while (at >= 0 && at < line.length && line[at] !== char) at += step;
      if (at < 0 || at >= line.length) return null;
      ch = at;
    }
    return { line: pos.line, ch: till ? ch - step : ch };
  }

  // Where a motion lands from `pos`, or null when it can't go. `forOperator` lets l reach past
  // the last character, as deleting up to the end of the line needs.
  function move(key, pos, { count, counted, char, forOperator }) {
    const repeat = (fn) => {
      let at = pos;
      for (let n = 0; n < count; n++) at = fn(at);
      return at;
    };
    const vertical = (delta, toFirst) => {
      const line = Math.max(0, Math.min(lastLine(), pos.line + delta));
      if (toFirst) return { line, ch: firstNonBlank(line) };
      column ??= pos.ch;
      return { line, ch: Math.min(column, Math.max(0, len(line) - 1)) };
    };
    switch (key) {
      case 'h': return { line: pos.line, ch: Math.max(0, pos.ch - count) };
      case 'l': return { line: pos.line, ch: Math.min(pos.ch + count, forOperator ? len(pos.line) : Math.max(0, len(pos.line) - 1)) };
      case 'j': return vertical(count);
      case 'k': return vertical(-count);
      case '+': return vertical(count, true);
      case '-': return vertical(-count, true);
      case 'w': case 'W': {
        const at = repeat((p) => nextWord(p, key === 'W'));
        // Deleting a line's last word stops at the end of the line, as in Vim.
        return forOperator && at.line > pos.line ? { line: pos.line, ch: len(pos.line) } : at;
      }
      case 'b': case 'B': return repeat((p) => previousWord(p, key === 'B'));
      case 'e': case 'E': return repeat((p) => wordEnd(p, key === 'E'));
      case '0': return { line: pos.line, ch: 0 };
      case '^': return { line: pos.line, ch: firstNonBlank(pos.line) };
      case '$': {
        const line = Math.min(lastLine(), pos.line + count - 1);
        return { line, ch: Math.max(0, len(line) - 1) };
      }
      case 'gg': case 'G': {
        const line = counted ? Math.min(lastLine(), count - 1) : key === 'gg' ? 0 : lastLine();
        return { line, ch: firstNonBlank(line) };
      }
      case 'f': case 'F': case 't': case 'T': return find(pos, key, char, count);
      default: return null;
    }
  }

  // --- Changing the text ---

  function deleteLines(a, b, { keepOne = false } = {}) {
    register = { text: linesOf(a, b), linewise: true };
    if (keepOne) text.replace({ line: a, ch: 0 }, { line: b, ch: len(b) }, '', { line: a, ch: 0 });
    else if (b < lastLine()) text.replace({ line: a, ch: 0 }, { line: b + 1, ch: 0 }, '', { line: a, ch: firstNonBlank(b + 1) });
    else if (a > 0) text.replace({ line: a - 1, ch: len(a - 1) }, { line: b, ch: len(b) }, '', { line: a - 1, ch: firstNonBlank(a - 1) });
    else text.replace({ line: 0, ch: 0 }, { line: b, ch: len(b) }, '', { line: 0, ch: 0 });
  }

  // Runs an operator from one place to another: up to `to`, or through it when `inclusive`, or
  // over every line between them when `linewise`.
  function operate(op, from, to, { linewise = false, inclusive = false } = {}) {
    if (linewise) {
      const a = Math.min(from.line, to.line);
      const b = Math.max(from.line, to.line);
      if (op === 'y') {
        register = { text: linesOf(a, b), linewise: true };
        text.setCursor(clampNormal({ line: a, ch: before(to, from) ? to.ch : from.ch }));
        return;
      }
      deleteLines(a, b, { keepOne: op === 'c' });
      if (op === 'c') enterInsert();
      return;
    }
    const [a, last] = ordered(from, to);
    const b = inclusive ? { line: last.line, ch: Math.min(last.ch + 1, len(last.line)) } : last;
    register = { text: between(a, b), linewise: false };
    if (op === 'y') {
      text.setCursor(a);
      return;
    }
    text.replace(a, b, '', a);
    if (op === 'c') enterInsert();
    else text.setCursor(clampNormal(a));
  }

  function paste(after, count) {
    if (!register.text) return;
    const pos = text.cursor();
    const chunk = Array(count).fill(register.text).join(register.linewise ? '\n' : '');
    if (register.linewise) {
      const end = { line: pos.line, ch: len(pos.line) };
      if (after) text.replace(end, end, `\n${chunk}`, { line: pos.line + 1, ch: 0 });
      else text.replace({ line: pos.line, ch: 0 }, { line: pos.line, ch: 0 }, `${chunk}\n`, { line: pos.line, ch: 0 });
      return;
    }
    const at = after && len(pos.line) ? { line: pos.line, ch: pos.ch + 1 } : pos;
    const parts = chunk.split('\n');
    const end = parts.length > 1
      ? { line: at.line + parts.length - 1, ch: Math.max(0, parts.at(-1).length - 1) }
      : { line: at.line, ch: at.ch + chunk.length - 1 };
    text.replace(at, at, chunk, end);
  }

  function joinLines(count) {
    const pos = text.cursor();
    const last = Math.min(lastLine(), pos.line + Math.max(1, count - 1));
    if (last === pos.line) return;
    const head = text.line(pos.line).replace(/\s+$/, '');
    const rest = [];
    for (let i = pos.line + 1; i <= last; i++) rest.push(text.line(i).trim());
    const joined = [head, ...rest.filter(Boolean)].join(' ');
    text.replace({ line: pos.line, ch: 0 }, { line: last, ch: len(last) }, joined, { line: pos.line, ch: head.length });
  }

  function toggleCase(from, to) {
    const [a, b] = ordered(from, to);
    const swapped = between(a, b).replace(/[^\n]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
    text.replace(a, b, swapped, a);
  }

  // --- Modes ---

  function enterInsert(at) {
    if (at) text.setCursor(at);
    mode = 'insert';
    anchor = null;
    cursor = null;
    caret();
  }

  // Leaving Insert steps back onto the last character typed, as in Vim.
  function enterNormal() {
    const pos = visual() ? cursor : text.cursor();
    const back = mode === 'insert' && pos.ch > 0;
    mode = 'normal';
    anchor = null;
    cursor = null;
    text.setCursor(clampNormal(back ? { line: pos.line, ch: pos.ch - 1 } : pos));
    caret();
  }

  function enterVisual(kind) {
    const pos = text.cursor();
    mode = kind;
    anchor = pos;
    cursor = pos;
    drawVisual();
    caret();
  }

  // Visual takes in the characters under both ends; Visual line, every line between them.
  function visualRange() {
    const [a, b] = ordered(anchor, cursor);
    if (mode === 'visual-line') return { from: { line: a.line, ch: 0 }, to: { line: b.line, ch: len(b.line) }, linewise: true };
    return { from: a, to: { line: b.line, ch: Math.min(b.ch + 1, len(b.line)) }, linewise: false };
  }

  function drawVisual() {
    const { from, to } = visualRange();
    if (before(cursor, anchor)) text.select(to, from);
    else text.select(from, to);
  }

  // --- Keys ---

  const reset = () => {
    keys = '';
    pending = { count: '', op: '', opCount: '', prefix: '' };
  };

  function done(name) {
    action = name;
    shownKeys = keys;
    reset();
    status();
    return true;
  }

  function wait(name) {
    action = name;
    status();
    return true;
  }

  const unknown = () => done(`Not in Vim lite: ${keys}`);

  // Normal and Visual read a command a key at a time: a count, an operator, another count, then
  // a motion; or a command of its own. `pending` holds what's been typed of it so far.
  function commandKey(key) {
    keys += key;
    const counted = !!(pending.count || pending.opCount);
    const count = (Number(pending.opCount) || 1) * (Number(pending.count) || 1);
    const { op, prefix } = pending;

    if (prefix === 'r') return replaceChar(key, count);
    if (prefix && MOTIONS[prefix]?.wantsChar) return runMotion(op, prefix, { count, counted, char: key });
    if (prefix === 'g') return key === 'g' ? runMotion(op, 'gg', { count, counted }) : unknown();

    // A lone 0 is a motion; after another digit it's part of the count.
    if (/\d/.test(key) && (key !== '0' || pending.count)) {
      pending.count += key;
      return wait('Count');
    }
    if (MOTIONS[key]?.wantsChar || key === 'g' || (key === 'r' && !op && !visual())) {
      pending.prefix = key;
      return wait(key === 'g' ? 'Go to…' : key === 'r' ? 'Replace with…' : `${MOTIONS[key].name}…`);
    }
    if (op) {
      if (key === op) {
        const pos = text.cursor();
        operate(op, pos, { line: Math.min(lastLine(), pos.line + count - 1), ch: 0 }, { linewise: true });
        return done(LINE_NAMES[op]);
      }
      return MOTIONS[key] ? runMotion(op, key, { count, counted }) : unknown();
    }
    if (!visual() && OPERATORS[key]) {
      pending.op = key;
      pending.opCount = pending.count;
      pending.count = '';
      return wait(`${OPERATORS[key]}…`);
    }
    if (MOTIONS[key]) return runMotion('', key, { count, counted });
    return visual() ? visualKey(key) : normalKey(key, count);
  }

  function runMotion(op, motion, { count, counted, char }) {
    const spec = MOTIONS[motion];
    const pos = here();
    const target = move(motion, pos, { count, counted, char, forOperator: !!op });
    if (!target) return done(`${spec.name}: not found`);
    if (!['j', 'k'].includes(motion)) column = null;
    if (!op) {
      if (visual()) {
        cursor = target;
        drawVisual();
      } else text.setCursor(clampNormal(target));
      return done(spec.name);
    }
    operate(op, pos, target, { linewise: !!spec.linewise, inclusive: !!spec.inclusive });
    return done(`${OPERATORS[op]} to ${spec.name.toLowerCase()}`);
  }

  function replaceChar(char, count) {
    const pos = text.cursor();
    if (pos.ch + count > len(pos.line)) return done('Replace: not enough characters');
    text.replace(pos, { line: pos.line, ch: pos.ch + count }, char.repeat(count), { line: pos.line, ch: pos.ch + count - 1 });
    return done('Replace character');
  }

  function normalKey(key, count) {
    const pos = text.cursor();
    const lineEnd = { line: pos.line, ch: len(pos.line) };
    const lines = { line: Math.min(lastLine(), pos.line + count - 1), ch: 0 };
    const chars = { line: pos.line, ch: Math.min(len(pos.line), pos.ch + count) };
    column = null;
    switch (key) {
      case 'i': enterInsert(); return done('Insert before');
      case 'a': enterInsert({ line: pos.line, ch: Math.min(pos.ch + 1, len(pos.line)) }); return done('Insert after');
      case 'I': enterInsert({ line: pos.line, ch: firstNonBlank(pos.line) }); return done('Insert at line start');
      case 'A': enterInsert(lineEnd); return done('Insert at line end');
      case 'o':
        text.replace(lineEnd, lineEnd, '\n', { line: pos.line + 1, ch: 0 });
        enterInsert();
        return done('Open line below');
      case 'O':
        text.replace({ line: pos.line, ch: 0 }, { line: pos.line, ch: 0 }, '\n', { line: pos.line, ch: 0 });
        enterInsert();
        return done('Open line above');
      case 'x':
        if (len(pos.line)) operate('d', pos, chars);
        return done('Delete character');
      case 'X':
        if (pos.ch) operate('d', { line: pos.line, ch: Math.max(0, pos.ch - count) }, pos);
        return done('Delete character before');
      case 's': operate('c', pos, chars); return done('Substitute character');
      case 'S': operate('c', pos, lines, { linewise: true }); return done('Change line');
      case 'D': operate('d', pos, lineEnd); return done('Delete to end of line');
      case 'C': operate('c', pos, lineEnd); return done('Change to end of line');
      case 'Y': operate('y', pos, lines, { linewise: true }); return done('Copy line');
      case 'p': paste(true, count); return done('Paste after');
      case 'P': paste(false, count); return done('Paste before');
      case 'u':
        for (let n = 0; n < count; n++) text.undo();
        text.setCursor(clampNormal(text.cursor()));
        return done('Undo');
      case 'J': joinLines(count); return done('Join lines');
      case '~':
        toggleCase(pos, chars);
        text.setCursor(clampNormal(chars));
        return done('Switch case');
      case 'v': enterVisual('visual'); return done('Visual');
      case 'V': enterVisual('visual-line'); return done('Visual line');
      default: return unknown();
    }
  }

  function visualKey(key) {
    const { from, to, linewise } = visualRange();
    const leave = (name) => {
      enterNormal();
      return done(name);
    };
    const apply = (op, name) => {
      mode = 'normal';
      anchor = null;
      cursor = null;
      operate(op, from, to, { linewise });
      caret();
      return done(name);
    };
    switch (key) {
      case 'd': case 'x': return apply('d', 'Delete selection');
      case 'y': return apply('y', 'Copy selection');
      case 'c': case 's': return apply('c', 'Change selection');
      case '~':
        mode = 'normal';
        toggleCase(from, to);
        caret();
        return done('Switch case');
      case 'o':
        [anchor, cursor] = [cursor, anchor];
        drawVisual();
        return done('Other end');
      case 'v': case 'V': {
        const kind = key === 'v' ? 'visual' : 'visual-line';
        if (mode === kind) return leave('Normal');
        mode = kind;
        drawVisual();
        return done(kind === 'visual' ? 'Visual' : 'Visual line');
      }
      default: return unknown();
    }
  }

  // Insert only listens for its ways out: Escape, or the chord when one is set.
  function insertKey(event) {
    const chord = options().chord ?? '';
    if (chord.length !== 2 || event.key.length !== 1) return false;
    const pos = text.cursor();
    const now = Date.now();
    const typedFirst = lastInsert.key === chord[0] && now - lastInsert.at < CHORD_MS;
    if (event.key === chord[1] && typedFirst && pos.ch > 0 && text.line(pos.line)[pos.ch - 1] === chord[0]) {
      lastInsert = { key: '', at: 0 };
      text.replace({ line: pos.line, ch: pos.ch - 1 }, pos, '', { line: pos.line, ch: pos.ch - 1 });
      mode = 'insert';
      enterNormal();
      // The first key of the chord went in as text; taking it out leaves no step to undo.
      keys = chord;
      return done('Normal');
    }
    lastInsert = { key: event.key, at: now };
    return false;
  }

  return {
    get mode() { return mode; },
    attach(api) {
      text = api;
      caret();
      status();
    },
    detach() {
      text?.setCaret(null);
      text = null;
    },
    /** Switches between Normal and Insert, as tapping the bubble does. */
    toggleMode() {
      if (!text) return;
      reset();
      shownKeys = '';
      if (mode === 'normal') enterInsert();
      else enterNormal();
      action = mode === 'insert' ? 'Insert' : 'Normal';
      status();
    },
    /** Shows the settings as they are now, such as the cursor's shape. */
    refresh() {
      caret();
      status();
    },
    keydown(event, api) {
      text = api;
      if (event.isComposing || event.key === 'Dead' || event.key === 'Process') return false;
      if (event.key === 'Escape' || (event.ctrlKey && event.key === '[')) {
        // With nothing to cancel, Escape is left for whatever else wants it.
        if (mode === 'normal' && !keys) return false;
        if (keys) {
          reset();
          return done('Cancelled');
        }
        enterNormal();
        return done('Normal');
      }
      if (mode === 'insert') return insertKey(event);
      // Ctrl and Cmd shortcuts belong to the app, apart from Ctrl+R, which redoes.
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() !== 'r' || event.shiftKey || event.altKey) return false;
        reset();
        text.redo();
        if (!visual()) text.setCursor(clampNormal(text.cursor()));
        keys = 'Ctrl+R';
        return done('Redo');
      }
      if (event.altKey) return false;
      // Tab would type, so outside Insert it does nothing.
      if (event.key === 'Tab') return !event.shiftKey;
      const key = KEY_ALIASES[event.key] ?? event.key;
      if (key.length !== 1) return false;
      return commandKey(key);
    },
    // Text that arrives without a key, such as from a phone's keyboard, stays out of the
    // script outside Insert mode.
    input() {
      return mode !== 'insert';
    },
  };
}
