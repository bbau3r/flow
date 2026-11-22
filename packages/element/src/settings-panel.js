// The settings layout shared by project and app settings. A search box sits at the top of the
// panel as its own island. Below it, when there's more than one section, a rail of section icons
// runs down the left, each naming itself in a label when pointed at, and each section is a page
// of its own that the rail turns to. A search looks through every section at once. Each section
// has a title and a button that folds or unfolds all its topics, and each topic folds on its own
// and holds the properties: a name with its control beside it, or below it when `wide`, then a
// description.

import { button, icon, pill, searchField, token } from './controls.js';

let ids = 0;
const nextId = (prefix) => `fl-${prefix}-${++ids}`;

const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((child) => child != null));
  return node;
};

const FIELD = /^(INPUT|SELECT|TEXTAREA)$/;

function buildProperty(property) {
  const name = el('span', 'fl-prop-label', property.label);
  name.id = nextId('prop');
  const controls = [property.control].flat().filter(Boolean);
  // A lone field with no name of its own is named by the property.
  if (controls.length === 1 && FIELD.test(controls[0].tagName) && !controls[0].hasAttribute('aria-label')) {
    controls[0].setAttribute('aria-labelledby', name.id);
  }
  const node = el('div', `fl-prop${property.wide ? ' fl-prop-wide' : ''}`,
    name,
    el('div', 'fl-prop-control', ...controls),
    property.below ? el('div', 'fl-prop-below', ...[property.below].flat()) : null,
    property.description ? el('p', 'fl-prop-desc', property.description) : null);
  return node;
}

/**
 * Opens the settings in `parent`. `sections` are { id, label, icon, topics }, topics are
 * { label, description, open = true, properties }, where `description` is a line under the
 * topic's name, and properties are { label, description, control, below,
 * wide, keywords }, where `control` is a node or a list of them, and `below` are nodes that run
 * the full width under it, such as a preview. A section with `hidden` set starts out of the
 * rail and out of searches, and the string 'divider' between sections draws a rule across the
 * rail. `start` names the section to open on. `actions` are buttons for the foot of the panel;
 * without them it has only its close button. `onClose` runs however it closes. Returns
 * { dialog, search, close(), show(id), setHidden(id, hidden) }.
 */
export function openSettingsPanel(parent, { title, icon: iconName, sections: listed, start, actions = [], onClose }) {
  const sections = listed.filter((section) => section && section !== 'divider');
  const { root: island, input: search } = searchField({ label: 'Search settings', cls: 'fl-settings-search' });

  const heading = el('h2', 'fl-settings-title', iconName ? icon(iconName) : null, title);
  heading.id = nextId('settings-title');
  const closeButton = button({ label: 'Close', icon: 'close', iconOnly: true, cls: 'fl-settings-close' });

  const content = el('div', 'fl-settings-content');
  const empty = el('p', 'fl-settings-empty', 'No settings match your search.');
  empty.hidden = true;
  const rail = pill({ cls: 'fl-pill-tinted fl-settings-rail', label: 'Sections' });
  const multiple = sections.length > 1;

  const built = sections.map((section) => {
    const sectionTitle = el('h3', 'fl-settings-section-title', section.label);
    sectionTitle.id = nextId('section');
    const toggleAll = button({ label: 'Collapse all', cls: 'fl-settings-toggle-all' });
    const topics = section.topics.map((topic) => {
      const head = el('button', 'fl-settings-topic-head', el('span', '', topic.label), icon('caret'));
      head.type = 'button';
      const props = topic.properties.map(buildProperty);
      // A topic can open with a line saying what it's about, before its properties.
      const body = el('div', 'fl-settings-topic-body', topic.description ? el('p', 'fl-settings-topic-desc', topic.description) : null, ...props);
      body.id = nextId('topic');
      head.setAttribute('aria-controls', body.id);
      const node = el('div', 'fl-settings-topic', el('h4', 'fl-settings-topic-title', head), body);
      const entry = { node, head, body, topic, properties: props.map((prop, i) => ({ prop, def: topic.properties[i] })) };
      entry.setOpen = (open) => {
        head.setAttribute('aria-expanded', String(open));
        node.classList.toggle('fl-settings-folded', !open);
      };
      entry.setOpen(topic.open !== false);
      head.addEventListener('click', () => {
        entry.setOpen(head.getAttribute('aria-expanded') !== 'true');
        syncToggle();
      });
      return entry;
    });
    const anyFolded = () => topics.some(({ head }) => head.getAttribute('aria-expanded') !== 'true');
    function syncToggle() {
      const folded = anyFolded();
      const label = folded ? 'Expand all' : 'Collapse all';
      toggleAll.replaceChildren(icon(folded ? 'expand-all' : 'collapse-all'), el('span', 'fl-label', label));
      toggleAll.setAttribute('aria-label', `${label} in ${section.label}`);
      toggleAll.title = label;
    }
    toggleAll.addEventListener('click', () => {
      const open = anyFolded();
      for (const topic of topics) topic.setOpen(open);
      syncToggle();
    });
    syncToggle();
    const node = el('section', 'fl-settings-section',
      el('div', 'fl-settings-section-head', sectionTitle, toggleAll),
      ...topics.map((topic) => topic.node));
    node.setAttribute('aria-labelledby', sectionTitle.id);
    if (section.id) node.dataset.section = section.id;

    const jump = button({ label: section.label, icon: section.icon ?? 'settings', iconOnly: true, toggle: true, cls: 'fl-settings-jump', attrs: { 'data-tip': section.label } });
    // The label names it, so the browser's own tooltip would only repeat it.
    jump.removeAttribute('title');
    const entry = { node, topics, jump, section, hidden: !!section.hidden };
    // Turning to a section ends a search, which would otherwise keep every section in view.
    jump.addEventListener('click', () => {
      search.value = '';
      turnTo(entry);
    });
    return entry;
  });
  content.append(...built.map(({ node }) => node), empty);

  // The rail lists the sections in order, with rules where the list asks for them.
  const railItems = listed.filter(Boolean).map((item) => {
    if (item !== 'divider') return built.find((entry) => entry.section === item).jump;
    const rule = el('div', 'fl-settings-rule');
    rule.setAttribute('aria-hidden', 'true');
    return rule;
  });
  rail.append(...railItems);
  // A rule shows only between buttons that show.
  function syncRail() {
    for (const entry of built) entry.jump.hidden = entry.hidden;
    railItems.forEach((item, i) => {
      if (!item.classList.contains('fl-settings-rule')) return;
      const shown = (list) => list.some((other) => !other.hidden && !other.classList.contains('fl-settings-rule'));
      item.hidden = !shown(railItems.slice(0, i)) || !shown(railItems.slice(i + 1));
    });
  }
  syncRail();

  // One section shows at a time, unless a search is showing what matches in all of them.
  const firstShown = () => built.find((entry) => !entry.hidden) ?? built[0];
  let current = built.find((entry) => entry.section.id === start && !entry.hidden) ?? firstShown();
  function turnTo(entry) {
    current = entry;
    for (const other of built) other.jump.setAttribute('aria-pressed', String(other === entry));
    filter();
    content.scrollTop = 0;
  }

  function filter() {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const entry of built) {
      // A hidden section stays out of searches, but can still be turned to with show().
      if (entry.hidden && (query || entry !== current)) {
        entry.node.hidden = true;
        continue;
      }
      let sectionShown = 0;
      for (const topic of entry.topics) {
        let topicShown = 0;
        for (const { prop, def } of topic.properties) {
          const text = [entry.section.label, topic.topic.label, def.label, def.description, def.keywords].filter(Boolean).join(' ').toLowerCase();
          const match = !query || text.includes(query);
          prop.hidden = !match;
          if (match) topicShown += 1;
        }
        // A topic's own description is searched too, and keeps a topic with nothing else showing.
        const about = [entry.section.label, topic.topic.label, topic.topic.description].filter(Boolean).join(' ').toLowerCase();
        if (topic.topic.description && (!query || about.includes(query))) topicShown = Math.max(topicShown, 1);
        topic.node.hidden = !topicShown;
        sectionShown += topicShown;
      }
      entry.node.hidden = query ? !sectionShown : entry !== current;
      shown += sectionShown;
    }
    // While searching, every matching topic shows its properties, folded or not.
    dialog.classList.toggle('fl-settings-searching', !!query);
    empty.hidden = shown > 0;
  }
  search.addEventListener('input', () => {
    filter();
    content.scrollTop = 0;
  });

  const main = el('div', 'fl-settings-main', multiple ? rail : null, content);
  const dialog = el('dialog', `fl-settings-dialog${multiple ? ' fl-settings-wide' : ''}`,
    el('div', 'fl-settings-head', heading, island, closeButton),
    main,
    actions.length ? el('div', 'fl-dialog-actions fl-settings-actions', ...actions) : null);
  dialog.setAttribute('aria-labelledby', heading.id);

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  parent.append(dialog);
  dialog.showModal();
  // The search box comes first, but opening on it would raise a phone's keyboard.
  closeButton.focus();
  turnTo(current);
  return {
    dialog,
    search,
    close: () => dialog.close(),
    /** Turns to a section, even one out of the rail, ending any search. */
    show(id) {
      const entry = built.find(({ section }) => section.id === id);
      if (!entry) return;
      search.value = '';
      turnTo(entry);
    },
    /** Takes a section out of the rail and searches, or brings it back. */
    setHidden(id, hidden) {
      const entry = built.find(({ section }) => section.id === id);
      if (!entry || entry.hidden === !!hidden) return;
      entry.hidden = !!hidden;
      syncRail();
      if (entry.hidden && current === entry) turnTo(firstShown());
      else filter();
    },
  };
}

export const SETTINGS_PANEL_CSS = `
.fl-settings-dialog {
  flex-direction: column;
  width: min(560px, calc(100vw - 24px)); max-width: none; max-height: min(680px, calc(100dvh - 24px));
  margin: auto; padding: 0; overflow: visible;
  background: ${token('dialog-bg')}; color: ${token('dialog-ink')};
  border: 1px solid var(--flow-rule); border-radius: ${token('dialog-radius')};
  box-shadow: 0 10px 40px var(--flow-shadow);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 14px; line-height: 1.35;
}
.fl-settings-dialog[open] { display: flex; }
.fl-settings-wide { width: min(760px, calc(100vw - 24px)); height: min(640px, calc(100dvh - 24px)); }
.fl-settings-dialog::backdrop { background: rgb(0 0 0 / 0.4); }

.fl-settings-head { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 12px 10px 18px; }
.fl-settings-title {
  flex: 1 0 auto; display: flex; align-items: center; gap: 8px; margin: 0; color: var(--flow-muted);
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.fl-settings-title > .fl-svg { width: 1.3em; height: 1.3em; color: var(--flow-accent); }
/* The search is an island at the top of the panel. */
.fl-settings-search { flex: 1 1 260px; max-width: 360px; font-size: 14px; }
.fl-settings-main { flex: 1 1 auto; min-height: 0; display: flex; gap: 6px; padding: 0 6px 6px 12px; }

/* The rail is a tinted pill of icon buttons, the current page pressed. */
.fl-settings-rail { flex: none; align-self: flex-start; flex-direction: column; gap: 4px; margin-top: 8px; padding: 5px; }
.fl-settings-jump { position: relative; --fl-control-size: 36px; padding: 0; }
.fl-settings-rule { flex: none; width: 60%; height: 1px; margin: 3px auto; background: currentColor; opacity: 0.3; }
.fl-settings-rule[hidden] { display: none; }
.fl-settings-searching .fl-settings-jump[aria-pressed="true"] { background: transparent; color: inherit; }
.fl-settings-jump::after {
  content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; z-index: 2;
  padding: 4px 12px; transform: translateY(-50%);
  background: ${token('pill-bg')}; color: ${token('pill-ink')};
  border: 1px solid ${token('pill-border')}; border-radius: ${token('pill-radius')};
  box-shadow: ${token('pill-shadow')};
  font-size: 13px; font-weight: 600; white-space: nowrap; pointer-events: none;
  opacity: 0; visibility: hidden; transition: opacity 120ms ease;
}
.fl-settings-jump:hover::after, .fl-settings-jump:focus-visible::after { opacity: 1; visibility: visible; }

.fl-settings-content {
  flex: 1; min-width: 0; overflow-y: auto; padding: 4px 12px 16px 8px;
  scrollbar-width: thin; scrollbar-color: ${token('scrollbar')} transparent;
}
.fl-settings-section:not([hidden]) ~ .fl-settings-section:not([hidden]) { margin-top: 22px; }
.fl-settings-section[hidden], .fl-settings-topic[hidden], .fl-prop[hidden], .fl-settings-empty[hidden] { display: none; }
.fl-settings-section-head { display: flex; align-items: center; gap: 8px; padding: 6px 0 4px; }
.fl-settings-section-title { flex: 1; margin: 0; font-size: 18px; font-weight: 600; }
.fl-settings-toggle-all { color: var(--flow-muted); font-size: 12.5px; }
.fl-settings-toggle-all .fl-svg { width: 1.1em; height: 1.1em; }
.fl-settings-searching .fl-settings-toggle-all { display: none; }
.fl-settings-topic { border-bottom: 1px solid var(--flow-rule); }
/* Rules only come between topics, never after the last one shown. */
.fl-settings-topic:not(:has(~ .fl-settings-topic:not([hidden]))) { border-bottom: 0; }
.fl-settings-topic-title { margin: 0; }
.fl-settings-topic-head {
  appearance: none; display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 6px 4px;
  background: transparent; color: inherit; border: 0; border-radius: 6px;
  font: inherit; font-size: 15px; font-weight: 600; text-align: left; cursor: pointer;
}
.fl-settings-topic-head > span { flex: 1; }
.fl-settings-topic-head:hover { background: ${token('button-hover-bg')}; }
.fl-settings-topic-head:focus-visible { outline: 2px solid ${token('focus')}; outline-offset: -2px; }
.fl-settings-topic-head > .fl-svg { width: 1.2em; height: 1.2em; color: var(--flow-accent); transition: transform 140ms ease; }
.fl-settings-folded .fl-settings-topic-head > .fl-svg { transform: rotate(-90deg); }
.fl-settings-topic-body { display: flex; flex-direction: column; gap: 14px; padding: 6px 4px 16px 18px; }
.fl-settings-folded > .fl-settings-topic-body { display: none; }
.fl-settings-topic-desc { margin: 0; color: var(--flow-muted); font-size: 13px; line-height: 1.45; }
.fl-settings-searching .fl-settings-folded > .fl-settings-topic-body { display: flex; }
.fl-settings-searching .fl-settings-folded .fl-settings-topic-head > .fl-svg { transform: none; }
@media (prefers-reduced-motion: reduce) { .fl-settings-topic-head > .fl-svg, .fl-settings-jump::after { transition: none; } }

.fl-prop { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 16px; }
.fl-prop-label { font-weight: 500; }
.fl-prop-control { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
.fl-prop-below { grid-column: 1 / -1; min-width: 0; }
.fl-prop-desc { grid-column: 1 / -1; margin: 0; color: var(--flow-muted); font-size: 12.5px; line-height: 1.4; }
.fl-prop-wide { grid-template-columns: minmax(0, 1fr); }
.fl-prop-wide > .fl-prop-control { display: block; }
.fl-prop select, .fl-prop textarea, .fl-prop input:not([type="checkbox"]):not([type="radio"]) {
  min-height: 30px; padding: 2px 6px;
  font: inherit; color: ${token('field-ink')}; background: ${token('field-bg')};
  border: 1px solid ${token('field-border')}; border-radius: 6px;
}
/* Text fields share the row with any buttons beside them, giving way first when it's narrow. */
.fl-prop textarea, .fl-prop-control > input:not([type="checkbox"]):not([type="radio"]) { flex: 0 1 240px; min-width: 0; }
.fl-prop textarea { align-self: center; line-height: 1.35; resize: vertical; }
.fl-prop-control > .fl-btn, .fl-prop-control > input[type="checkbox"] { align-self: flex-start; }
.fl-prop-control > input[type="checkbox"]:not(.fl-switch) { width: 18px; height: 18px; margin: 6px 2px; }
.fl-prop-control > .fl-switch { margin: 5px 2px; }
.fl-prop textarea:disabled { opacity: 0.5; }
.fl-prop:not(.fl-prop-wide) { grid-template-columns: minmax(6em, 1fr) minmax(0, auto); }
.fl-settings-empty { margin: 24px 0; color: var(--flow-muted); text-align: center; }
.fl-settings-actions { flex: none; margin: 0; padding: 6px 16px 14px; }

/* On a phone the search takes a row of its own under the title. */
@media (max-width: 600px) {
  .fl-settings-dialog, .fl-settings-wide { width: calc(100vw - 16px); max-height: calc(100dvh - 16px); }
  .fl-settings-wide { height: calc(100dvh - 16px); }
  .fl-settings-head { padding-left: 14px; }
  .fl-settings-search { order: 3; flex-basis: 100%; max-width: none; }
  .fl-settings-main { padding-left: 8px; }
  .fl-settings-content { padding-right: 6px; }
  .fl-settings-toggle-all .fl-label { display: none; }
  .fl-settings-topic-body { padding-left: 8px; }
}
`;
