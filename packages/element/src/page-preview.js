// A small drawing of a page size: the sheet, in the paper color of the theme, scaled to fit
// its frame, with a measured line along its width and its height.

import { parseDimensions } from '@flow/core';

// How much room the frame keeps for the page, once the measure lines and their labels have theirs.
const ROOM = { width: 200, height: 130 };

// Named sizes are measured in the units they're defined in.
const NAMED = {
  letter: { width: 8.5, height: 11, unit: 'in' },
  a4: { width: 210, height: 297, unit: 'mm' },
};

const div = (className) => {
  const node = document.createElement('div');
  node.className = className;
  return node;
};

export function pagePreview(paper) {
  const frame = div('fl-preview');
  frame.setAttribute('role', 'img');
  const sheet = div('fl-preview-sheet');
  const across = div('fl-measure fl-measure-width');
  const down = div('fl-measure fl-measure-height');
  const acrossLabel = div('fl-measure-label');
  const downLabel = div('fl-measure-label');
  across.append(acrossLabel);
  down.append(downLabel);
  sheet.append(across, down);
  frame.append(sheet);

  const show = (value) => {
    const size = parseDimensions(value) ?? 'letter';
    const { width, height, unit } = typeof size === 'string' ? NAMED[size] : size;
    const scale = Math.min(ROOM.width / width, ROOM.height / height);
    sheet.style.width = `${Math.round(width * scale)}px`;
    sheet.style.height = `${Math.round(height * scale)}px`;
    acrossLabel.textContent = `${width} ${unit}`;
    downLabel.textContent = `${height} ${unit}`;
    frame.setAttribute('aria-label', `Page ${width} by ${height} ${unit}`);
  };
  show(paper);
  return { root: frame, show };
}

export const PAGE_PREVIEW_CSS = `
.fl-preview {
  display: flex; align-items: center; justify-content: center;
  height: 190px; margin-top: 8px; padding: 0 0 28px 64px;
  background: color-mix(in srgb, var(--flow-ink) 4%, transparent); border-radius: 8px;
}
.fl-preview-sheet {
  position: relative; box-sizing: border-box;
  background: var(--flow-paper); border: 1px solid var(--flow-rule); border-radius: 2px;
  box-shadow: 0 1px 4px var(--flow-shadow);
  transition: width 160ms ease, height 160ms ease;
}
@media (prefers-reduced-motion: reduce) { .fl-preview-sheet { transition: none; } }
.fl-measure { position: absolute; box-sizing: border-box; border: 0 solid var(--flow-secondary); }
.fl-measure::before { content: ""; position: absolute; background: var(--flow-secondary); }
.fl-measure-width { left: 0; right: 0; top: calc(100% + 8px); height: 7px; border-width: 0 1px; }
.fl-measure-width::before { left: 0; right: 0; top: 3px; height: 1px; }
.fl-measure-height { top: 0; bottom: 0; right: calc(100% + 8px); width: 7px; border-width: 1px 0; }
.fl-measure-height::before { top: 0; bottom: 0; left: 3px; width: 1px; }
.fl-measure-label { position: absolute; color: var(--flow-secondary); font-size: 11px; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fl-measure-width > .fl-measure-label { top: 11px; left: 50%; transform: translateX(-50%); }
.fl-measure-height > .fl-measure-label { right: 11px; top: 50%; transform: translateY(-50%); }
`;
