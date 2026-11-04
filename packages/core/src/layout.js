// Turns a parsed script into pages of positioned rows. The read-only view and
// the PDF both draw this output, and the editor uses it to place page breaks, so
// all three agree. Units are monospace columns (0.1in) and rows (1/6in).
// Metrics follow afterwriting's print profiles.

export const PROFILES = {
  letter: { paper: 'letter', widthIn: 8.5, heightIn: 11, linesPerPage: 55, actionWidth: 61 },
  a4: { paper: 'a4', widthIn: 8.27, heightIn: 11.7, linesPerPage: 57, actionWidth: 58 },
};
export const COL = { action: 15, parenthetical: 30, character: 35, dialogue: 25 };
export const WIDTH = { character: 33, parenthetical: 26, dialogue: 36 };

export const DEFAULT_OPTIONS = {
  paper: 'letter',
  titlePage: true,
  sceneNumbers: true,
  boldScenes: false,
  underlineScenes: false,
  doubleSpaceScenes: false,
  pageNumbers: true,
  more: '(MORE)',
  contd: "(CONT'D)",
};

function sliceRuns(runs, a, b) {
  const out = [];
  let pos = 0;
  for (const r of runs) {
    const from = Math.max(a, pos);
    const to = Math.min(b, pos + r.text.length);
    if (to > from) out.push({ ...r, text: r.text.slice(from - pos, to - pos) });
    pos += r.text.length;
  }
  return out;
}

export function wrapRuns(runs, width) {
  const text = runs.map((r) => r.text).join('');
  if (!text) return [[]];
  const rows = [];
  let pos = 0;
  while (text.length - pos > width) {
    const window = text.slice(pos, pos + width + 1);
    let brk = window.lastIndexOf(' ');
    let next = brk + 1;
    if (brk <= 0 || !window.slice(0, brk).trim()) {
      const hyphen = window.lastIndexOf('-', width - 1);
      brk = hyphen > 0 ? hyphen + 1 : width;
      next = brk;
    }
    rows.push(sliceRuns(runs, pos, pos + brk));
    pos += next;
    while (text[pos] === ' ') pos++;
  }
  if (pos < text.length) rows.push(sliceRuns(runs, pos, text.length));
  return rows;
}

const cleanRuns = (line, extra) =>
  line.runs.map((r) => ({
    text: r.text.replace(/\t/g, '    '),
    bold: !!r.bold,
    italic: !!r.italic,
    underline: !!r.underline,
    ...extra,
  }));
const runsLen = (runs) => runs.reduce((n, r) => n + r.text.length, 0);
const plainRun = (text) => [{ text, bold: false, italic: false, underline: false }];
const blankRow = (line) => ({ cells: [], line, type: 'blank', notes: [] });

function titleRows(parsed, profile) {
  const { titlePage, lines } = parsed;
  if (!titlePage.length) return null;
  const rows = [];
  const pageCols = Math.round(profile.widthIn * 10);
  const wrapped = (keys, width) =>
    titlePage
      .filter((e) => keys.includes(e.key))
      .map((e) => e.lines.flatMap((i) => wrapRuns(cleanRuns(lines[i]), width).map((runs) => ({ runs, line: i }))));

  let y = 15; // 3.5in from the page top, below the 1in margin
  for (const entry of wrapped(['title', 'credit', 'author', 'authors', 'source'], profile.actionWidth)) {
    for (const { runs, line } of entry) {
      rows.push({ y: y++, type: 'title', line, notes: [], cells: [{ x: Math.max(0, Math.floor((pageCols - runsLen(runs)) / 2)), runs }] });
    }
    y += 2;
  }
  const bottom = (keys, x) => {
    const col = wrapped(keys, 30).flat();
    col.forEach(({ runs, line }, i) => {
      rows.push({ y: profile.linesPerPage - col.length + i, type: 'title', line, notes: [], cells: [{ x, runs }] });
    });
  };
  bottom(['notes', 'copyright'], COL.action);
  bottom(['draft date', 'date', 'contact'], COL.action + profile.actionWidth - 30);
  return rows.sort((a, b) => a.y - b.y);
}

const SINGLE_COL = {
  character: COL.character,
  parenthetical: COL.parenthetical,
  dialogue: COL.dialogue,
  characterWidth: WIDTH.character,
  parenthesisWidth: WIDTH.parenthetical,
  dialogueWidth: WIDTH.dialogue,
};
const dualCol = (base) => ({ character: base + 5, parenthetical: base + 2, dialogue: base, characterWidth: 25, parenthesisWidth: 22, dialogueWidth: 27 });

// Rows for a character cue plus everything spoken under it.
function dialogueRows(lines, start, col, notes) {
  const rows = [];
  let i = start;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const spoken = l.type === 'parenthetical' || l.type === 'dialogue' || (l.type === 'lyrics' && l.inDialogue);
    if (i > start && !spoken && l.type !== 'comment') break;
    for (const c of l.comments) if (c.comment.type === 'note' && c.comment.lineStart === i) notes.push(c.comment);
    if (l.type === 'comment') continue;
    const kind = l.type === 'lyrics' ? 'dialogue' : l.type;
    const runs = l.type === 'lyrics' ? cleanRuns(l, { italic: true }) : cleanRuns(l);
    const width = kind === 'character' ? col.characterWidth : kind === 'parenthetical' ? col.parenthesisWidth : col.dialogueWidth;
    wrapRuns(runs, width).forEach((row, n) => {
      rows.push({ type: kind, line: i, notes: n === 0 ? notes.splice(0) : [], cells: row.length ? [{ x: col[kind], runs: row }] : [] });
    });
  }
  return { rows, end: i };
}

function buildBlocks(parsed, profile, opts) {
  const { lines } = parsed;
  const W = profile.actionWidth;
  const blocks = [];
  const notes = [];
  let hiddenSinceText = false;
  const last = () => blocks[blocks.length - 1];
  const rowNotes = () => notes.splice(0);
  const pushAction = (row) => {
    if (last()?.type === 'action') last().rows.push(row);
    else blocks.push({ type: 'action', rows: [row] });
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.type !== 'character') {
      for (const c of l.comments) if (c.comment.type === 'note' && c.comment.lineStart === i) notes.push(c.comment);
    }
    if (l.type === 'title' || l.type === 'section' || l.type === 'synopsis' || l.type === 'comment') {
      hiddenSinceText = true;
      continue;
    }
    if (l.type === 'blank') {
      // Hidden lines take no page space, including the blank lines that set them apart.
      if (hiddenSinceText && (!blocks.length || last().type === 'blank')) continue;
      blocks.push({ type: 'blank', rows: [blankRow(i)] });
      continue;
    }
    if (l.type === 'page-break') {
      blocks.push({ type: 'break', rows: [] });
      hiddenSinceText = true;
      continue;
    }
    hiddenSinceText = false;

    if (l.type === 'character') {
      const col = l.dual ? dualCol(COL.action + Math.floor(W / 2)) : SINGLE_COL;
      const { rows, end } = dialogueRows(lines, i, col, notes);
      const prev = blocks[blocks.length - 2];
      if (l.dual && last()?.type === 'blank' && prev?.type === 'dialogue' && !prev.dual) {
        blocks.pop();
        const left = dialogueRows(lines, prev.rows[0].line, dualCol(COL.action), []).rows;
        const leftNotes = prev.rows.flatMap((r) => r.notes);
        const merged = [];
        for (let r = 0; r < Math.max(left.length, rows.length); r++) {
          const a = left[r];
          const b = rows[r];
          merged.push({ type: 'dual', line: (a ?? b).line, notes: [...(a?.notes ?? []), ...(b?.notes ?? [])], cells: [...(a?.cells ?? []), ...(b?.cells ?? [])] });
        }
        merged[0].notes.push(...leftNotes);
        prev.rows = merged;
        prev.dual = true;
      } else {
        blocks.push({ type: 'dialogue', rows, name: l.name, dual: false });
      }
      i = end - 1;
      continue;
    }

    if (l.type === 'scene') {
      if (opts.doubleSpaceScenes && blocks.length) blocks.push({ type: 'blank', rows: [blankRow(i)] });
      let runs = cleanRuns(l);
      if (!l.forced) runs = runs.map((r) => ({ ...r, text: r.text.toUpperCase() }));
      if (opts.boldScenes) runs = runs.map((r) => ({ ...r, bold: true }));
      if (opts.underlineScenes) runs = runs.map((r) => ({ ...r, underline: true }));
      const rows = wrapRuns(runs, W).map((row, n) => {
        const cells = row.length ? [{ x: COL.action, runs: row }] : [];
        if (n === 0 && l.sceneNumber && opts.sceneNumbers) {
          cells.unshift({ x: COL.action - l.sceneNumber.length - 3, runs: plainRun(l.sceneNumber) });
          cells.push({ x: COL.action + W + 2, runs: plainRun(l.sceneNumber) });
        }
        return { type: 'scene', line: i, notes: n === 0 ? rowNotes() : [], cells };
      });
      blocks.push({ type: 'scene', rows, keepNext: true });
      continue;
    }
    if (l.type === 'transition') {
      for (const row of wrapRuns(cleanRuns(l).map((r) => ({ ...r, text: r.text.toUpperCase() })), W)) {
        blocks.push({ type: 'transition', rows: [{ type: 'transition', line: i, notes: rowNotes(), cells: [{ x: COL.action + W - runsLen(row), runs: row }] }] });
      }
      continue;
    }
    if (l.type === 'centered') {
      for (const row of wrapRuns(cleanRuns(l), W)) {
        pushAction({ type: 'centered', line: i, notes: rowNotes(), cells: [{ x: COL.action + Math.floor((W - runsLen(row)) / 2), runs: row }] });
      }
      continue;
    }
    // Action, plus lyrics outside of dialogue.
    const base = l.type === 'lyrics' ? cleanRuns(l, { italic: true }) : cleanRuns(l);
    for (const row of wrapRuns(base, W)) {
      pushAction({ type: l.type, line: i, notes: rowNotes(), cells: row.length ? [{ x: COL.action, runs: row }] : [] });
    }
  }
  if (notes.length) {
    const target = [...blocks].reverse().find((b) => b.rows.length);
    if (target) target.rows[target.rows.length - 1].notes.push(...notes);
    else blocks.push({ type: 'blank', rows: [{ ...blankRow(lines.length - 1), notes: [...notes] }] });
  }
  return blocks;
}

function paginate(blocks, profile, opts) {
  const L = profile.linesPerPage;
  const pages = [];
  let cur = [];
  const finish = () => {
    while (cur.length && cur[cur.length - 1].type === 'blank' && !cur[cur.length - 1].notes.length) cur.pop();
    pages.push(cur);
    cur = [];
  };
  const minRows = (b) => {
    if (b.dual) return b.rows.length;
    return Math.min(b.rows.length, b.type === 'dialogue' ? 3 : 2);
  };

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (block.type === 'break') {
      if (cur.length) finish();
      continue;
    }
    if (block.type === 'blank') {
      if (!cur.length && !block.rows[0].notes.length) continue;
      if (cur.length >= L) { finish(); continue; }
      cur.push(block.rows[0]);
      continue;
    }
    // A scene heading must not be stranded at the foot of a page.
    let keep = 0;
    if (block.keepNext) {
      let n = b + 1;
      while (blocks[n]?.type === 'blank') { keep++; n++; }
      keep = blocks[n] && blocks[n].type !== 'break' ? keep + minRows(blocks[n]) : 0;
    }
    let rows = block.rows;
    const splitsDialogue = block.type === 'dialogue' && !block.dual;
    while (rows.length) {
      if (!cur.length) keep = 0;
      const room = L - cur.length;
      if (rows.length + keep <= room) {
        cur.push(...rows);
        break;
      }
      let take = 0;
      if (splitsDialogue) {
        // Leave room for (MORE), end on spoken text, and keep 2+ spoken rows on each side.
        take = Math.max(0, Math.min(room - 1, rows.length - 2));
        while (take > 0 && (rows[take - 1].type !== 'dialogue' || !rows[take - 1].cells.length)) take--;
        const spoken = rows.slice(0, take).filter((r) => r.type === 'dialogue').length;
        if (spoken < 2) take = 0;
      } else if (block.type === 'action') {
        take = Math.min(room, rows.length - 2);
        if (take < 2) take = 0;
      }
      // A block longer than a whole page has to break somewhere regardless.
      if (!take && !cur.length) take = splitsDialogue ? L - 1 : L;
      cur.push(...rows.slice(0, take));
      rows = rows.slice(take);
      if (take && splitsDialogue) {
        const line = rows[0].line;
        cur.push({ type: 'more', line, notes: [], cells: [{ x: COL.character, runs: plainRun(opts.more) }] });
        const name = block.rows[0].cells[0]?.runs.map((r) => r.text).join('') ?? block.name;
        rows = [{ type: 'character', line, notes: [], cells: [{ x: COL.character, runs: plainRun(`${name} ${opts.contd}`) }] }, ...rows];
      }
      finish();
    }
  }
  if (cur.length || !pages.length) finish();
  return pages;
}

export function layout(parsed, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const profile = PROFILES[opts.paper] ?? PROFILES.letter;
  const pages = [];
  const title = opts.titlePage ? titleRows(parsed, profile) : null;
  if (title) pages.push({ kind: 'title', number: null, rows: title });

  paginate(buildBlocks(parsed, profile, opts), profile, opts).forEach((rows, n) => {
    rows.forEach((r, y) => { r.y = y; });
    pages.push({ kind: 'script', number: n + 1, showNumber: opts.pageNumbers && n > 0, rows });
  });
  // Where each page after the first begins, for the editor's break markers.
  const pageStarts = pages
    .filter((p) => p.kind === 'script' && p.number > 1 && p.rows.length)
    .map((p) => ({ number: p.number, line: p.rows[0].line }));
  return { profile, options: opts, pages, pageStarts };
}
