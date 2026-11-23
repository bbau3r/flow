// How people in a P2P session are shown: a round badge in their color with their alias's first
// letter, and those badges stacked, overlapping, for everyone who's in. They show inside the
// script's bars, which are in its shadow root, as well as on the page, so their styles are a
// string both can take.

import { h } from '../ui.js';

export const AVATAR_CSS = `
.p2p-avatar {
  --p2p-size: 26px;
  display: inline-flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box;
  width: var(--p2p-size); height: var(--p2p-size); border-radius: 50%;
  background: var(--p2p-color, #888); color: #fff;
  font: 700 calc(var(--p2p-size) * 0.46)/1 var(--flow-ui-font, Roboto, system-ui, sans-serif);
  box-shadow: 0 0 0 2px var(--flow-ribbon-bg, #fff);
  user-select: none;
}
.p2p-avatar-more { background: var(--flow-ribbon-bg); color: var(--flow-ink); border: 1px solid var(--flow-rule); font-size: 11px; }
.p2p-stack { display: inline-flex; align-items: center; padding-left: 9px; }
.p2p-stack > .p2p-avatar { margin-left: -9px; }
`;

/** The first letter of an alias, for its badge. */
const initial = (alias) => [...String(alias ?? '?').trim()][0]?.toUpperCase() ?? '?';

/** A member's badge, `size` pixels across. */
export function avatar(member, size = 26) {
  const node = h('span', { class: 'p2p-avatar', title: member.alias, 'aria-hidden': 'true' }, initial(member.alias));
  node.style.setProperty('--p2p-color', member.color);
  node.style.setProperty('--p2p-size', `${size}px`);
  return node;
}

/**
 * Members' badges, overlapping, the first on top, with +n for any past `max`. `first` is the one
 * to lead with, such as yourself.
 */
export function avatarStack(members, { first = null, max = 3, size = 24 } = {}) {
  const ordered = [...members].sort((a, b) => (b.id === first) - (a.id === first));
  const shown = ordered.slice(0, max);
  const stack = h('span', { class: 'p2p-stack' }, ...shown.map((member) => avatar(member, size)));
  if (ordered.length > max) {
    const more = h('span', { class: 'p2p-avatar p2p-avatar-more', 'aria-hidden': 'true' }, `+${ordered.length - max}`);
    more.style.setProperty('--p2p-size', `${size}px`);
    stack.append(more);
  }
  // The first is drawn over the rest.
  [...stack.children].forEach((child, i) => {
    child.style.position = 'relative';
    child.style.zIndex = String(stack.children.length - i);
  });
  return stack;
}

// The page needs the badges' styles too, for the card and the Connect dialog.
if (!document.getElementById('p2p-avatar-css')) {
  const style = h('style', { id: 'p2p-avatar-css' });
  style.textContent = AVATAR_CSS;
  document.head.append(style);
}
