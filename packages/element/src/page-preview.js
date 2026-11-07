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
