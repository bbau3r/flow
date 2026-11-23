// The Vim lite engine: a small part of Vim's keys, read one at a time, working on the script
// through the editor's text API and nothing else. It keeps a mode, the command being typed, and a
// register for what was last deleted or copied. Each change it makes is one undo step.
//
// Normal mode moves and edits; Insert types as usual; Visual and Visual line select. / and ?
// search for words, which n and N find again. Registers hold what's copied: the unnamed one,
// a to z, and + and * for the system clipboard, which the unnamed one can share. q records the
// keys of a macro into a register, and @ plays it back. What it knows is in MOTIONS, OPERATORS,
// commandKey, normalKey and visualKey, and the README lists it too.

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

export const MODE_LABELS = { normal: 'NORMAL', insert: 'INSERT', visual: 'VISUAL', 'visual-line': 'V-LINE', search: 'SEARCH', match: 'MATCH' };

// How long a blinking cursor takes to blink once, in milliseconds.
const BLINK_PERIODS = { slow: 1600, normal: 1000, fast: 600 };

// The keys a macro keeps: what was pressed, and the modifiers that change what it does.
const remember = (event) => ({ key: event.key, ctrlKey: !!event.ctrlKey, metaKey: !!event.metaKey, altKey: !!event.altKey, shiftKey: !!event.shiftKey });
const SPECIAL_KEYS = new Set(['Escape', 'Enter', 'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const worthKeeping = (event) => event.key.length === 1 || SPECIAL_KEYS.has(event.key);

// Macros can play other macros, up to here, so one that plays itself stops.
const MACRO_DEPTH = 20;

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
 * Starts an engine. `options()` gives { startMode, chord, blockCursor, blink, blinkSpeed, wrap,
 * escapeKey } as they are now, and `onStatus({ mode, keys, pending, action, recording })` hears
 * what to show after every key: the mode, the keys of the command typed or being typed, what it
 * did or is waiting for, and the register a macro is being recorded into, if one is.
 */
export function createVim({ options, onStatus }) {
  let mode = options().startMode === 'insert' ? 'insert' : 'normal';
  let keys = ''; // the command so far, as typed
  let shownKeys = ''; // the last command, shown until the next key
  let action = '';
  let pending = { count: '', op: '', opCount: '', prefix: '', reg: '' };
  // The unnamed register, and a to z. Each holds { text, linewise }.
  let register = { text: '', linewise: false };
  const named = new Map();
  // What Flow last put on the system clipboard, to tell when something newer was copied elsewhere.
  let lastClip = null;
  // A macro being recorded, { name, keys }, the macros kept, by register, and the last one played.
  let recording = null;
  const macros = new Map();
  let lastMacro = '';
  let playing = 0;
  // Work that has to wait, such as reading the clipboard, and the keys pressed meanwhile.
  let busy = null;
  const backlog = [];
  // A search's match was the last thing found, so the mode reads Match until the next key.
  let matched = false;
  let goalX = null; // how far across the screen j and k keep to, following wrapped lines
  let anchor = null; // where Visual mode started
  let cursor = null; // Visual mode's moving end; the other modes use the editor's own cursor
  let column = null; // the column j and k try to keep
  let lastInsert = { key: '', at: 0 };
  // A count before i, a, I, A, o or O, kept until Insert is left.
  let insertRepeat = null;
  // A search being typed after / or ?, and the last one run, which n and N find again.
  let searching = null;
  let lastSearch = null;
  let text = null;

  const visual = () => mode === 'visual' || mode === 'visual-line';
  // While a search is typed the mode reads Search, and once it's found, Match.
  const shownMode = () => (searching ? 'search' : matched && mode === 'normal' ? 'match' : mode);
  const status = () => onStatus({ mode: shownMode(), keys: keys || shownKeys, pending: !!keys, action, recording: recording?.name ?? '' });

  const caret = () => {
    const settings = options();
    text?.setCaret(mode !== 'insert' && settings.blockCursor !== false ? 'block' : null, {
      blink: settings.blink !== false,
      period: BLINK_PERIODS[settings.blinkSpeed] ?? BLINK_PERIODS.normal,
    });
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
      // Following wrapped lines, each step is a row on screen, keeping to the same distance
      // across. An operator still takes whole lines, as in Vim.
      if (!toFirst && !forOperator && options().wrap !== false && text.screenLine) {
        let at = pos;
        for (let n = 0; n < Math.abs(delta); n++) {
          const next = text.screenLine(at, Math.sign(delta), goalX);
          if (!next) break;
          at = next.place;
          goalX = next.x;
        }
        return at;
      }
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

  // --- Registers and the clipboard ---

  const shareClipboard = () => !!navigator.clipboard;

  // Puts what was copied or deleted where the command asked: a named register, the system
  // clipboard, or nowhere for _, and the unnamed register too, which shares the clipboard.
  function keep(entry) {
    const target = pending.reg;
    if (target === '_') return;
    if (/^[a-z]$/.test(target)) named.set(target, entry);
    if (/^[A-Z]$/.test(target)) {
      // A capital adds to the register.
      const was = named.get(target.toLowerCase());
      named.set(target.toLowerCase(), was ? { text: `${was.text}${entry.linewise || was.linewise ? '\n' : ''}${entry.text}`, linewise: was.linewise || entry.linewise } : entry);
    }
    register = entry;
    if (target === '+' || target === '*' || shareClipboard()) {
      lastClip = entry.linewise ? `${entry.text}\n` : entry.text;
      navigator.clipboard?.writeText(lastClip).catch(() => {});
    }
  }

  const fromClipboard = (clip) => {
    const clean = clip.replace(/\r\n?/g, '\n');
    return clean.endsWith('\n') ? { text: clean.slice(0, -1), linewise: true } : { text: clean, linewise: false };
  };

  // What a paste puts in, which can wait on reading the system clipboard: a named register, the
  // clipboard for + and *, or the unnamed register, unless something newer was copied elsewhere.
  async function pasteSource(target) {
    if (/^[a-zA-Z]$/.test(target)) return named.get(target.toLowerCase()) ?? null;
    if (target === '+' || target === '*' || shareClipboard()) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && (target === '+' || target === '*' || clip !== lastClip)) return fromClipboard(clip);
      } catch {
        // Not allowed to read it, which leaves Vim's own.
      }
    }
    return register;
  }

  // Runs work that waits, such as on the clipboard. Keys pressed meanwhile wait their turn, and
  // are played once it's done, before anything else. Work started by other work, such as a paste
  // in a macro, is what the key that started it waits on.
  let inner = null;
  function later(work) {
    const run = async () => {
      try {
        await work();
      } catch (err) {
        console.error(err);
      }
    };
    if (busy) {
      inner = run();
      return;
    }
    let release;
    busy = new Promise((resolve) => { release = resolve; });
    (async () => {
      await run();
      while (backlog.length) await feed(backlog.shift());
      busy = null;
      release();
    })();
  }

  // --- Changing the text ---

  function deleteLines(a, b, { keepOne = false } = {}) {
    keep({ text: linesOf(a, b), linewise: true });
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
        keep({ text: linesOf(a, b), linewise: true });
        text.setCursor(clampNormal({ line: a, ch: before(to, from) ? to.ch : from.ch }));
        return;
      }
      deleteLines(a, b, { keepOne: op === 'c' });
      if (op === 'c') enterInsert();
      return;
    }
    const [a, last] = ordered(from, to);
    const b = inclusive ? { line: last.line, ch: Math.min(last.ch + 1, len(last.line)) } : last;
    keep({ text: between(a, b), linewise: false });
    if (op === 'y') {
      text.setCursor(a);
      return;
    }
    text.replace(a, b, '', a);
    if (op === 'c') enterInsert();
    else text.setCursor(clampNormal(a));
  }

  // Pastes from the register the command named, once its text is known.
  function paste(after, count) {
    const target = pending.reg;
    later(async () => {
      const entry = await pasteSource(target);
      if (text && entry?.text) put(entry, after, count);
    });
  }

  function put(entry, after, count) {
    const pos = text.cursor();
    const chunk = Array(count).fill(entry.text).join(entry.linewise ? '\n' : '');
    if (entry.linewise) {
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
    insertRepeat = null;
    mode = 'insert';
    anchor = null;
    cursor = null;
    caret();
  }

  // Where `chunk` ends when it goes in at `at`.
  const endOf = (at, chunk) => {
    const parts = chunk.split('\n');
    return parts.length > 1 ? { line: at.line + parts.length - 1, ch: parts.at(-1).length } : { line: at.line, ch: at.ch + chunk.length };
  };

  // Types a counted insert's text the rest of its times: 3ihey gives heyheyhey, and 3ofoo gives
  // three lines of foo. A cursor moved back before where typing began repeats nothing.
  function repeatInsert() {
    const repeat = insertRepeat;
    insertRepeat = null;
    if (!repeat || mode !== 'insert') return;
    const end = text.cursor();
    if (before(end, repeat.from)) return;
    if (repeat.lines) {
      const typed = linesOf(repeat.from.line, end.line);
      const at = { line: end.line, ch: len(end.line) };
      const rows = end.line - repeat.from.line + 1;
      text.replace(at, at, `\n${typed}`.repeat(repeat.count - 1), { line: end.line + rows * (repeat.count - 1), ch: end.ch });
      return;
    }
    const typed = between(repeat.from, end);
    if (!typed) return;
    const chunk = typed.repeat(repeat.count - 1);
    text.replace(end, end, chunk, endOf(end, chunk));
  }

  // Leaving Insert steps back onto the last character typed, as in Vim.
  function enterNormal() {
    repeatInsert();
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
    searching = null;
    pending = { count: '', op: '', opCount: '', prefix: '', reg: '' };
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

    if (prefix === '"') {
      if (!/^[a-zA-Z+*_"]$/.test(key)) return unknown();
      pending.reg = key === '"' ? '' : key;
      pending.prefix = '';
      return wait(key === '+' || key === '*' ? 'System clipboard…' : key === '_' ? 'Nowhere…' : `Register ${key}…`);
    }
    if (prefix === 'q') {
      if (!/^[a-z]$/.test(key)) return unknown();
      recording = { name: key, keys: [] };
      return done(`Recording @${key}`);
    }
    if (prefix === '@') {
      const name = key === '@' ? lastMacro : key;
      if (!/^[a-z]$/.test(name) || !macros.has(name)) return done(name ? `No macro in @${name}` : 'No macro played yet');
      return playMacro(name, count);
    }
    if (prefix === 'r') return replaceChar(key, count);
    if (prefix && MOTIONS[prefix]?.wantsChar) return runMotion(op, prefix, { count, counted, char: key });
    if (prefix === 'g') return key === 'g' ? runMotion(op, 'gg', { count, counted }) : unknown();

    if (key === '"' && !op) {
      pending.prefix = '"';
      return wait('Register…');
    }
    if (key === 'q' && !op && !visual()) {
      if (recording) {
        const { name, keys: kept } = recording;
        recording = null;
        macros.set(name, kept);
        return done(`Recorded @${name}`);
      }
      pending.prefix = 'q';
      return wait('Record into…');
    }
    if (key === '@' && !op && !visual()) {
      pending.prefix = '@';
      return wait('Play…');
    }

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
    if (key === '/' || key === '?') return startSearch(key === '/' ? 1 : -1, count);
    if (key === 'n' || key === 'N') {
      if (!lastSearch) return done('No search yet');
      return findAgain(lastSearch, key === 'n' ? lastSearch.dir : -lastSearch.dir, count);
    }
    if (key === '*' || key === '#') {
      const word = wordAt(here());
      if (!word) return done('No word here');
      return findAgain({ text: word, whole: true, dir: key === '*' ? 1 : -1 }, key === '*' ? 1 : -1, count);
    }
    if (MOTIONS[key]) return runMotion('', key, { count, counted });
    return visual() ? visualKey(key) : normalKey(key, count);
  }

  // --- Searching ---

  const escapeRegExp = (words) => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Every place the words are found, in order, leaving out lines out of sight. A search ignores
  // case unless it holds a capital, and * and # look for whole words.
  function matchesOf({ text: wanted, whole }) {
    const body = escapeRegExp(wanted);
    const pattern = new RegExp(whole ? `(?<!\\w)${body}(?!\\w)` : body, /[A-Z]/.test(wanted) ? 'g' : 'gi');
    const found = [];
    for (let line = 0; line < text.lineCount; line++) {
      if (text.hidden(line)) continue;
      for (const match of text.line(line).matchAll(pattern)) found.push({ line, ch: match.index });
    }
    return found;
  }

  // The word under the cursor, or the next one along its line, for * and #.
  function wordAt({ line, ch }) {
    const words = [...text.line(line).matchAll(/\w+/g)];
    const word = words.find((match) => match.index + match[0].length > ch);
    return word?.[0] ?? '';
  }

  // Goes to the next place the search is found, `count` times, in `dir`, coming round from the
  // other end of the script when it runs out, as Vim does.
  function findAgain(search, dir, count) {
    lastSearch = search;
    const found = matchesOf(search);
    if (!found.length) return done(`No match for “${search.text}”`);
    let at = here();
    let index = -1;
    let wrapped = false;
    for (let n = 0; n < count; n++) {
      index = dir > 0 ? found.findIndex((match) => before(at, match)) : found.findLastIndex((match) => before(match, at));
      if (index < 0) {
        index = dir > 0 ? 0 : found.length - 1;
        wrapped = true;
      }
      at = found[index];
    }
    column = null;
    goalX = null;
    if (visual()) {
      cursor = at;
      drawVisual();
    } else text.setCursor(at);
    const round = wrapped ? (dir > 0 ? ', from the top' : ', from the bottom') : '';
    matched = !visual();
    return done(`${index + 1} of ${found.length}${round}`);
  }

  function startSearch(dir, count) {
    pending = { count: '', op: '', opCount: '', prefix: '', reg: '' };
    searching = { dir, count, text: '' };
    keys = dir > 0 ? '/' : '?';
    return wait(dir > 0 ? 'Type to search forward' : 'Type to search back');
  }

  // While a search is typed, keys go into it. Enter runs it, or the last one when it's empty;
  // Backspace takes a character back, and on an empty search cancels it.
  function searchKey(event) {
    const typing = searching;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Enter') {
      const words = typing.text || lastSearch?.text;
      searching = null;
      if (!words) return done('Nothing to search for');
      return findAgain({ text: words, whole: !typing.text && !!lastSearch?.whole, dir: typing.dir }, typing.dir, typing.count);
    }
    if (event.key === 'Backspace') {
      if (!typing.text) {
        reset();
        return done('Cancelled');
      }
      typing.text = typing.text.slice(0, -1);
    } else if (event.key.length === 1) {
      typing.text += event.key;
    } else {
      // Arrows and the like would only move the cursor out from under the search.
      return true;
    }
    keys = (typing.dir > 0 ? '/' : '?') + typing.text;
    // As it's typed, it counts what it would find.
    const count = typing.text ? matchesOf({ text: typing.text, whole: false }).length : 0;
    return wait(!typing.text ? 'Type to search' : `${count} ${count === 1 ? 'match' : 'matches'}`);
  }

  function runMotion(op, motion, { count, counted, char }) {
    const spec = MOTIONS[motion];
    const pos = here();
    const target = move(motion, pos, { count, counted, char, forOperator: !!op });
    if (!target) return done(`${spec.name}: not found`);
    if (!['j', 'k'].includes(motion)) {
      column = null;
      goalX = null;
    }
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

  // With a count, what's typed goes in that many times, once Insert is left.
  function countedInsert(at, name, count, lines = false) {
    enterInsert(at);
    if (count > 1) insertRepeat = { count, from: text.cursor(), lines };
    return done(count > 1 ? `${name}, ${count} times` : name);
  }

  function normalKey(key, count) {
    const pos = text.cursor();
    const lineEnd = { line: pos.line, ch: len(pos.line) };
    const lines = { line: Math.min(lastLine(), pos.line + count - 1), ch: 0 };
    const chars = { line: pos.line, ch: Math.min(len(pos.line), pos.ch + count) };
    column = null;
    switch (key) {
      case 'i': return countedInsert(null, 'Insert before', count);
      case 'a': return countedInsert({ line: pos.line, ch: Math.min(pos.ch + 1, len(pos.line)) }, 'Insert after', count);
      case 'I': return countedInsert({ line: pos.line, ch: firstNonBlank(pos.line) }, 'Insert at line start', count);
      case 'A': return countedInsert(lineEnd, 'Insert at line end', count);
      case 'o':
        text.replace(lineEnd, lineEnd, '\n', { line: pos.line + 1, ch: 0 });
        return countedInsert(null, 'Open line below', count, true);
      case 'O':
        text.replace({ line: pos.line, ch: 0 }, { line: pos.line, ch: 0 }, '\n', { line: pos.line, ch: 0 });
        return countedInsert(null, 'Open line above', count, true);
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

  // --- Macros ---

  // Plays a macro's keys `count` times, as if they were pressed, once anything waiting is done.
  function playMacro(name, count) {
    lastMacro = name;
    const kept = macros.get(name);
    done(`Playing @${name}`);
    if (playing >= MACRO_DEPTH) return true;
    later(async () => {
      playing += 1;
      try {
        for (let n = 0; n < count; n++) {
          for (const key of kept) await feed(key);
        }
      } finally {
        playing -= 1;
      }
    });
    return true;
  }

  // A key from a macro or one that waited: handled as if pressed, and in Insert mode, typed.
  async function feed(key) {
    if (!text) return;
    if (!handle(key) && mode === 'insert') typeInInsert(key);
    if (inner) {
      const waiting = inner;
      inner = null;
      await waiting;
    }
  }

  // Types what a key would type in Insert mode, as the browser does for a key that's pressed.
  // What's typed joins one undo step, as typing does.
  function typeInInsert(key) {
    if (key.ctrlKey || key.metaKey || key.altKey) return;
    const pos = text.cursor();
    const typing = { join: true };
    if (key.key.length === 1) text.replace(pos, pos, key.key, { line: pos.line, ch: pos.ch + 1 }, typing);
    else if (key.key === 'Enter') text.replace(pos, pos, '\n', { line: pos.line + 1, ch: 0 }, typing);
    else if (key.key === 'Backspace') {
      const back = backward(pos);
      if (back) text.replace(back, pos, '', back, typing);
    } else if (key.key === 'Delete') {
      const on = forward(pos);
      if (on) text.replace(pos, on, '', pos, typing);
    } else if (key.key === 'ArrowLeft') text.setCursor(backward(pos) ?? pos);
    else if (key.key === 'ArrowRight') text.setCursor(forward(pos) ?? pos);
    else if (key.key === 'ArrowUp' || key.key === 'ArrowDown') {
      const line = Math.max(0, Math.min(lastLine(), pos.line + (key.key === 'ArrowUp' ? -1 : 1)));
      text.setCursor({ line, ch: Math.min(pos.ch, len(line)) });
    }
  }

  // The key as Vim reads it. The key chosen to work as Escape reads as Escape. Caps Lock still
  // turns capitals on when it's that key, so letters read as if it were off.
  function settle(event) {
    const kept = remember(event);
    const chosen = options().escapeKey;
    if (chosen && event.key === chosen && !event.ctrlKey && !event.metaKey && !event.altKey) return { ...kept, key: 'Escape' };
    if (chosen === 'CapsLock' && /^[a-zA-Z]$/.test(event.key) && event.getModifierState?.('CapsLock')) {
      const flipped = event.key === event.key.toUpperCase() ? event.key.toLowerCase() : event.key.toUpperCase();
      return { ...kept, key: flipped, flipped: true };
    }
    return kept;
  }

  // Handles a key, pressed or played: returns true when Vim takes it.
  function handle(event) {
    if (event.isComposing || event.key === 'Dead' || event.key === 'Process') return false;
    matched = false;
    if (event.key === 'Escape' || (event.ctrlKey && event.key === '[')) {
      // With nothing to cancel, Escape is left for whatever else wants it.
      if (mode === 'normal' && !keys) {
        status();
        return false;
      }
      if (keys) {
        reset();
        return done('Cancelled');
      }
      enterNormal();
      return done('Normal');
    }
    if (searching) return searchKey(event);
    if (mode === 'insert') {
      if (insertKey(event)) return true;
      // With Caps Lock as Escape, a letter types as if Caps Lock were off.
      if (event.flipped) {
        typeInInsert(event);
        return true;
      }
      return false;
    }
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
    /** Switches between Normal and Insert, as tapping the widget's mode does. */
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
      const key = settle(event);
      // While something waits, such as a paste on the clipboard, keys wait their turn.
      if (busy && worthKeeping(key)) {
        backlog.push(key);
        if (recording) recording.keys.push(key);
        return true;
      }
      // A macro keeps every key pressed while it records, apart from the q that ends it.
      const recordingInto = recording;
      const taken = handle(key);
      if (recordingInto && recording === recordingInto && worthKeeping(key)) recordingInto.keys.push(key);
      return taken;
    },
    // Text that arrives without a key, such as from a phone's keyboard, stays out of the
    // script outside Insert mode.
    input() {
      return mode !== 'insert';
    },
  };
}
