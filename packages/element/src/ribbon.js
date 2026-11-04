// What sits above the script: the document, tabs and export controls, which an app fills
// through named slots, and the formatting controls, which follow the line the cursor is on.
// They share a row when there's room. All of it goes inside the scrolling area, so that the
// script can pass beneath it.

import { actionPill, button, centerGlyphs, glyphBadge, Menu, pill, pillSep } from './controls.js';

const STYLE_BUTTONS = [
  { key: 'bold', label: 'Bold', text: 'B', cls: 'fl-b', title: 'Bold (Ctrl/Cmd+B)' },
  { key: 'italic', label: 'Italic', text: 'I', cls: 'fl-i', title: 'Italic (Ctrl/Cmd+I)' },
  { key: 'underline', label: 'Underline', text: 'U', cls: 'fl-u', title: 'Underline (Ctrl/Cmd+U)' },
];

// Each badge shows what you could type by hand. Dialogue is the exception: Fountain
// has no marker for it, since any text under a character cue is dialogue.
const TOPIC_SECTIONS = [
  [
    { value: 'scene', glyph: '.', label: 'Scene', title: 'Scene heading. Type . to force one.' },
    { value: 'action', glyph: '!', label: 'Action', title: 'Action. Type ! to force it.' },
    { value: 'transition', glyph: '>', label: 'Transition', title: 'Transition. Type > to force one.' },
    { value: 'centered', glyph: '><', label: 'Centered', title: 'Centered text. Wrap it in > <.' },
    { value: 'lyrics', glyph: '~', label: 'Lyrics', title: 'Lyrics. Type ~ at the start of the line.' },
  ],
  [
    { value: 'character', glyph: '@', label: 'Character', title: 'Character cue. Type @ to force one.' },
    { value: 'parenthetical', glyph: '()', label: 'Parenthetical', title: 'Parenthetical. Wrap it in ( ) under a character.' },
    { value: 'dialogue', glyph: '“', label: 'Dialogue', title: 'Dialogue. No marker needed: it is any text under a character.' },
  ],
  [
    { value: 'section-1', glyph: '#', label: 'Act', title: 'Outline section, level 1. Type #. Not printed.' },
    { value: 'section-2', glyph: '##', label: 'Sequence', title: 'Outline section, level 2. Type ##. Not printed.' },
    { value: 'synopsis', glyph: '=', label: 'Synopsis', title: 'Synopsis. Type =. Not printed.' },
  ],
];

// Lines the dropdown can show but doesn't offer, because they have their own controls.
const OTHER_TOPICS = [
  { value: 'note', glyph: '[[', label: 'Comment' },
  { value: 'boneyard', glyph: '/*', label: 'Boneyard' },
  { value: 'page-break', glyph: '===', label: 'Page break' },
  { value: 'section-3', glyph: '###', label: 'Section' },
  { value: 'title', glyph: ':', label: 'Title page' },
];

const TOPICS = new Map([...TOPIC_SECTIONS.flat(), ...OTHER_TOPICS].map((topic) => [topic.value, topic]));
const ACTION = TOPICS.get('action');

// The topics that offer dual dialogue as an extra.
const DUAL_TOPICS = new Set(['character', 'parenthetical', 'dialogue']);

const COLLAPSE_MS = 220;

const slot = (name) => {
  const node = document.createElement('slot');
  node.name = name;
  return node;
};

const cell = (className, ...children) => {
  const node = document.createElement('div');
  node.className = className;
  node.append(...children);
  return node;
};

function createTopBar(actions) {
  const pdf = { label: 'PDF', title: 'Export a PDF', icon: 'pdf', onClick: () => actions.openExport() };
  const exportHolder = cell('fl-topbar-end fl-export-holder');
  const setExportActions = (appActions) => {
    exportHolder.replaceChildren(actionPill({ label: 'Export', cls: 'fl-export' }, appActions.length ? [appActions, [pdf]] : [[pdf]]));
  };
  setExportActions([]);
  const bar = document.createElement('div');
  bar.className = 'fl-topbar';
  const tabsCell = cell('fl-topbar-tabs', slot('tabs'));
  bar.append(cell('fl-topbar-start', slot('document'), tabsCell), exportHolder);
  return { bar, tabsCell, exportHolder, setExportActions };
}

export function createRibbon(actions) {
  const pressed = new Map();
  const toggle = (key, options, onClick) => {
    const b = button({ ...options, toggle: true, onClick });
    pressed.set(key, b);
    return b;
  };

  const boneyard = toggle('boneyard', {
    label: 'Boneyard',
    text: 'S',
    cls: 'fl-strike',
    title: 'Boneyard: cut text that stays in the file but never prints. Wrap it in /* */.',
  }, () => actions.boneyard());
  const pageBreak = button({
    label: 'Page break',
    title: 'Insert a page break. Type === on its own line.',
    icon: 'page-break',
    iconOnly: true,
    onClick: () => actions.pageBreak(),
  });
  const styles = pill({ label: 'Text style' },
    ...STYLE_BUTTONS.map(({ key, ...options }) => toggle(key, options, () => actions.emphasis(key))),
    pillSep(),
    boneyard);

  const comment = toggle('note', {
    label: 'Comment',
    title: 'Comment, shown as a bubble. Wrap it in [[ ]].',
    icon: 'comment',
    iconOnly: true,
  }, () => actions.setLineType('note'));

  // A line with nothing on it is about to be action, so that's what it shows.
  let topic = ACTION;
  let lineType = 'blank';
  const topics = new Menu({
    cls: 'fl-topics',
    sections: TOPIC_SECTIONS.map((items) => ({ items })),
    isChecked: (value) => value === topic.value,
    trigger: () => {
      const name = document.createElement('span');
      name.className = 'fl-topic-name';
      name.textContent = topic.label;
      return { label: `Topic: ${topic.label}`, content: [glyphBadge(topic.glyph), name] };
    },
    onSelect: (value) => {
      // A blank line is action already, and forcing it would only add a stray marker.
      if (!(value === 'action' && lineType === 'blank')) actions.setLineType(value);
    },
  });

  const dual = toggle('dual', {
    label: 'Dual',
    title: 'Dual dialogue: place this speech beside the previous one. Type ^ after the name.',
    glyph: '^',
    collapse: true,
    cls: 'fl-btn-soft',
  }, () => actions.dual());
  const additions = pill({ label: 'Topic options' }, dual);
  additions.hidden = true;

  const row = document.createElement('div');
  row.className = 'fl-ribbon';
  row.setAttribute('role', 'toolbar');
  row.setAttribute('aria-label', 'Formatting');
  const formatting = cell('fl-format-pills',
    styles,
    pill({ label: 'Topic' }, topics.root),
    pill({ label: 'Page break' }, pageBreak),
    pill({ label: 'Comments' }, comment),
    additions);

  const collapseButton = button({
    label: 'Hide formatting',
    icon: 'chevron-left',
    iconOnly: true,
    cls: 'fl-format-toggle',
    attrs: { 'aria-expanded': 'true' },
    onClick: () => setCollapsed(collapseButton.getAttribute('aria-expanded') === 'true'),
  });

  let animation = null;
  let pillAnimations = [];
  const clearPillAnimations = () => {
    for (const running of pillAnimations) running.cancel();
    pillAnimations = [];
  };
  // The Web Animations API needs no timing kept in step with the CSS, and it can start
  // from wherever an interrupted animation had got to. The space closes up while each pill
  // fades on its own, which keeps its shadow whole, unlike fading or clipping them as a group.
  function setCollapsed(collapsed) {
    const label = collapsed ? 'Show formatting' : 'Hide formatting';
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', label);
    collapseButton.title = label;
    topics.close();

    const from = formatting.getBoundingClientRect().width;
    animation?.cancel();
    clearPillAnimations();
    formatting.hidden = false;
    formatting.classList.add('fl-format-animating');
    const to = collapsed ? 0 : formatting.scrollWidth;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : COLLAPSE_MS;
    const shown = { opacity: 1, transform: 'none' };
    const gone = { opacity: 0, transform: 'translateX(-8px)' };
    pillAnimations = [...formatting.children].filter((child) => !child.hidden).map((child) => child.animate(
      collapsed ? [shown, gone] : [gone, shown],
      { duration, easing: 'ease', fill: 'forwards' },
    ));
    const running = formatting.animate(
      [{ width: `${from}px` }, { width: `${to}px` }],
      { duration, easing: 'ease' },
    );
    animation = running;
    running.finished.then(() => {
      formatting.classList.remove('fl-format-animating');
      formatting.hidden = collapsed;
      clearPillAnimations();
    }).catch(() => {}); // cancelled by a newer click, which has taken over
  }

  row.append(formatting, collapseButton);

  const root = document.createElement('div');
  root.className = 'fl-chrome';
  const topBar = createTopBar(actions);
  topBar.bar.insertBefore(row, topBar.exportHolder);
  root.append(topBar.bar);

  // The bundled font can replace a fallback after the badges were first measured.
  const recenter = () => centerGlyphs(root);
  document.fonts.ready.then(recenter);
  document.fonts.addEventListener('loadingdone', recenter);

  return {
    root,
    setExportActions: topBar.setExportActions,
    destroy() {
      document.fonts.removeEventListener('loadingdone', recenter);
      topics.close();
      root.remove();
    },
    update(state) {
      for (const [key, b] of pressed) b.setAttribute('aria-pressed', String(state.type === key || state[key] === true));
      // This runs on every keystroke, and the topic rarely changes.
      lineType = state.type;
      const nextTopic = TOPICS.get(state.type) ?? ACTION;
      if (nextTopic !== topic) {
        topic = nextTopic;
        topics.refresh();
      }
      additions.hidden = !DUAL_TOPICS.has(state.type);
    },
    // Preview is only for reading, so nothing that edits or changes tab stays on show. The
    // Outline tab has its own controls, and the formatting ones act on the script's cursor.
    setView(view, outlining = false) {
      const previewing = view === 'preview' && !outlining;
      row.hidden = previewing || outlining;
      topBar.tabsCell.hidden = previewing;
      if (row.hidden) topics.close();
    },
  };
}
