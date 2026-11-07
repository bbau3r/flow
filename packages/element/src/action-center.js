// The action center: the row of commands under the document and tabs. Each tab registers its
// own set of pills, such as formatting for Write or adding cards for Outline, and the row shows
// the current tab's set, or nothing. Each set can be folded away on its own.

import { button } from './controls.js';

const COLLAPSE_MS = 220;

const cell = (className, ...children) => {
  const node = document.createElement('div');
  node.className = className;
  node.append(...children);
  return node;
};

export function createActionCenter() {
  const sets = new Map();
  let current = null;

  const pills = cell('fl-action-pills');
  const toggle = button({
    label: 'Hide',
    icon: 'chevron-left',
    iconOnly: true,
    cls: 'fl-action-toggle',
    attrs: { 'aria-expanded': 'true' },
    onClick: () => setCollapsed(!current.collapsed),
  });

  const root = cell('fl-ribbon', pills, toggle);
  root.setAttribute('role', 'toolbar');
  root.hidden = true;

  const labelToggle = () => {
    const name = current.label.toLowerCase();
    const label = current.collapsed ? `Show ${name}` : `Hide ${name}`;
    toggle.setAttribute('aria-expanded', String(!current.collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  };

  let animation = null;
  let pillAnimations = [];
  const stopAnimations = () => {
    animation?.cancel();
    animation = null;
    for (const running of pillAnimations) running.cancel();
    pillAnimations = [];
    pills.classList.remove('fl-action-animating');
  };

  // The Web Animations API needs no timing kept in step with the CSS, and it can start
  // from wherever an interrupted animation had got to. The space closes up while each pill
  // fades on its own, which keeps its shadow whole, unlike fading or clipping them as a group.
  function setCollapsed(collapsed) {
    current.collapsed = collapsed;
    current.onCollapse?.();
    labelToggle();

    const from = pills.getBoundingClientRect().width;
    stopAnimations();
    pills.hidden = false;
    pills.classList.add('fl-action-animating');
    const to = collapsed ? 0 : pills.scrollWidth;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : COLLAPSE_MS;
    const shown = { opacity: 1, transform: 'none' };
    const gone = { opacity: 0, transform: 'translateX(-8px)' };
    pillAnimations = [...pills.children].filter((child) => !child.hidden).map((child) => child.animate(
      collapsed ? [shown, gone] : [gone, shown],
      { duration, easing: 'ease', fill: 'forwards' },
    ));
    const running = pills.animate(
      [{ width: `${from}px` }, { width: `${to}px` }],
      { duration, easing: 'ease' },
    );
    animation = running;
    running.finished.then(() => {
      pills.classList.remove('fl-action-animating');
      pills.hidden = collapsed;
      for (const fading of pillAnimations) fading.cancel();
      pillAnimations = [];
    }).catch(() => {}); // cancelled by a newer click, or a change of set, which has taken over
  }

  return {
    root,
    /**
     * Registers a set of pills under `name`, replacing any set already there. `label` names
     * the toolbar, and `onCollapse` runs as the set is folded away or brought back.
     */
    set(name, { label, pills: nodes, onCollapse }) {
      const previous = sets.get(name);
      sets.set(name, { label, nodes, onCollapse, collapsed: previous?.collapsed ?? false });
      if (current && current === previous) this.show(name);
    },
    /** Shows the set registered as `name`, or hides the row for a name with no set. */
    show(name) {
      const next = sets.get(name) ?? null;
      if (next === current && (!next || pills.firstChild === next.nodes[0])) return;
      stopAnimations();
      current = next;
      root.hidden = !current;
      if (!current) {
        pills.replaceChildren();
        return;
      }
      root.setAttribute('aria-label', current.label);
      pills.replaceChildren(...current.nodes);
      pills.hidden = current.collapsed;
      labelToggle();
    },
  };
}
