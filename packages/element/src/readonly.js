// Read-only rendering: plain DOM built from the parser and layout engine. This
// module must never import Tiptap, so that read-only pages stay small.

import { parse, layout, COL } from '@flow/core';

const NOTE_ICON = '\u{1F4AC}︎';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function runsInto(parent, runs) {
  for (const run of runs) {
    const classes = [run.bold && 'fl-bold', run.italic && 'fl-italic', run.underline && 'fl-underline'].filter(Boolean).join(' ');
    if (classes) parent.append(el('span', classes, run.text));
    else parent.append(run.text);
  }
}

const CLOSE_ICON = '×';

// In flow view a pill can sit near the right edge, so nudge its panel back inside.
function keepPanelInView(details, panel) {
  panel.style.left = '';
  const root = details.closest('.fl-flow');
  if (!details.open || !root) return;
  const overflow = panel.getBoundingClientRect().right - root.getBoundingClientRect().right;
  if (overflow > 0) panel.style.left = `${-overflow}px`;
}

export function bubble(comment) {
  const details = el('details', 'fl-bubble');
  const summary = el('summary');
  const label = `Note: ${comment.text}`;
  summary.setAttribute('aria-label', label);
  summary.append(
    el('span', 'fl-bubble-icon', NOTE_ICON),
    el('span', 'fl-bubble-close', CLOSE_ICON),
    el('span', 'fl-bubble-preview', comment.text.split('\n')[0]),
  );
  const panel = el('div', 'fl-bubble-body', comment.text);
  details.append(summary, panel);
  details.addEventListener('toggle', () => {
    summary.setAttribute('aria-label', details.open ? 'Close note' : label);
    keepPanelInView(details, panel);
  });
  return details;
}

function renderPages(parsed, options) {
  const result = layout(parsed, options);
  const root = el('div', 'fl-script fl-pages');
  for (const page of result.pages) {
    const sheet = el('section', 'fl-page');
    sheet.dataset.page = page.number ?? 'title';
    sheet.setAttribute('aria-label', page.number ? `Page ${page.number}` : 'Title page');
    if (page.showNumber) {
      const label = `${page.number}.`;
      const number = el('div', 'fl-page-number', label);
      number.style.left = `${(COL.action + result.profile.actionWidth - label.length) * 0.6}em`;
      sheet.append(number);
    }
    for (const row of page.rows) {
      if (!row.cells.length && !row.notes.length) continue;
      const rowEl = el('div', 'fl-row');
      rowEl.style.top = `${6 + row.y}em`;
      rowEl.dataset.line = row.line;
      for (const cell of row.cells) {
        const cellEl = el('div', 'fl-cell');
        cellEl.style.left = `${cell.x * 0.6}em`;
        runsInto(cellEl, cell.runs);
        rowEl.append(cellEl);
      }
      if (row.notes.length) {
        const stack = el('div', 'fl-bubbles');
        stack.append(...row.notes.map(bubble));
        rowEl.append(stack);
      }
      sheet.append(rowEl);
    }
    root.append(sheet);
  }
  return root;
}

const FLOW_HIDDEN = new Set(['section', 'synopsis', 'page-break', 'comment', 'title']);

function flowLine(line) {
  const div = el('div', `fl-line fl-${line.type}`);
  div.dataset.line = line.index;
  if (line.forced) div.classList.add('fl-forced');
  if (line.inDialogue) div.classList.add('fl-in-dialogue');
  const parts = [...line.runs.map((r) => ({ at: r.start, run: r }))];
  for (const c of line.comments) {
    if (c.comment.type === 'note' && c.comment.lineStart === line.index) parts.push({ at: c.start, note: c.comment });
  }
  parts.sort((a, b) => a.at - b.at);
  for (const p of parts) {
    if (p.note) div.append(bubble(p.note));
    else runsInto(div, [p.run]);
  }
  return div;
}

function renderFlow(parsed) {
  const root = el('div', 'fl-script fl-flow');
  const { lines } = parsed;
  if (parsed.titlePage.length) {
    for (const entry of parsed.titlePage) {
      for (const i of entry.lines) {
        const div = flowLine(lines[i]);
        div.className = `fl-line fl-title fl-title-${entry.key.replace(/\s+/g, '-')}`;
        root.append(div);
      }
    }
    root.append(el('div', 'fl-line'));
  }
  let lastWasHidden = true;
  let lastBlock = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === 'title') continue;
    if (FLOW_HIDDEN.has(line.type)) {
      for (const c of line.comments) {
        if (c.comment.type === 'note' && c.comment.lineStart === i) root.append(bubble(c.comment));
      }
      lastWasHidden = true;
      continue;
    }
    if (line.type === 'blank') {
      if (lastWasHidden) continue;
      root.append(flowLine(line));
      lastWasHidden = true; // collapse runs of blank lines into one
      continue;
    }
    lastWasHidden = false;
    if (line.type === 'character') {
      const block = el('div', 'fl-speech');
      let j = i;
      for (; j < lines.length; j++) {
        const next = lines[j];
        const spoken = next.type === 'parenthetical' || next.type === 'dialogue' || (next.type === 'lyrics' && next.inDialogue);
        if (j > i && !spoken && next.type !== 'comment') break;
        if (next.type !== 'comment') block.append(flowLine(next));
        else for (const c of next.comments) if (c.comment.type === 'note' && c.comment.lineStart === j) block.append(bubble(c.comment));
      }
      i = j - 1;
      if (line.dual && lastBlock && root.lastElementChild?.classList.contains('fl-blank') && root.lastElementChild.previousElementSibling === lastBlock) {
        root.lastElementChild.remove();
        const dual = el('div', 'fl-dual');
        lastBlock.replaceWith(dual);
        dual.append(lastBlock, block);
        lastBlock = null;
      } else {
        root.append(block);
        lastBlock = block;
      }
      continue;
    }
    root.append(flowLine(line));
  }
  return root;
}

export function renderReadonly(source, { view, options }) {
  const parsed = parse(source);
  return view === 'flow' ? renderFlow(parsed) : renderPages(parsed, options);
}
