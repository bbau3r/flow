// Flow's mark drawn inline, colored from the current theme: the primary color (accent) at the
// top shading down into the secondary at the bottom, each stroke a light band over a deep one.
// The app icon keeps the fixed brand colors; both come from the shapes in mark-paths.js.

import { BRANCH, GRADIENTS, MAIN, VIEWBOX } from './mark-paths.js';

const NS = 'http://www.w3.org/2000/svg';
const accent = 'var(--flow-accent)';
const secondary = 'var(--flow-secondary)';
const mix = (a, b, share) => `color-mix(in oklab, ${a} ${share}%, ${b})`;

const STOPS = {
  light: [mix(accent, 'white', 92), mix(accent, secondary, 50), mix(secondary, 'white', 72)],
  deep: [mix(accent, 'black', 76), mix(mix(accent, secondary, 50), 'black', 82), mix(secondary, 'black', 84)],
  branchLight: [mix(mix(accent, secondary, 45), 'white', 85), mix(secondary, 'white', 70)],
  branchDeep: [mix(mix(accent, secondary, 45), 'black', 82), mix(accent, 'black', 76)],
};

let count = 0;

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

/** The mark as an SVG element. Size it with CSS; it keeps its own aspect ratio. */
export function flowMark() {
  const id = `flow-mark-${++count}-`;
  const gradients = Object.entries(GRADIENTS).map(([name, [x1, y1, x2, y2]]) =>
    el('linearGradient', { id: id + name, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 },
      STOPS[name].map((color, i, all) => el('stop', { offset: i / (all.length - 1), style: `stop-color:${color}` }))));
  const path = (d, name) => el('path', { d, fill: `url(#${id}${name})` });
  return el('svg', { class: 'flow-mark', viewBox: VIEWBOX, 'aria-hidden': 'true', focusable: 'false' }, [
    el('defs', {}, gradients),
    path(BRANCH.deep, 'branchDeep'), path(BRANCH.light, 'branchLight'),
    path(MAIN.deep, 'deep'), path(MAIN.light, 'light'),
  ]);
}
