// What sits above the script: the document, tabs and export controls, which an app fills
// through named slots, and the action center, which holds the current tab's commands, such as
// the formatting controls that follow the line the cursor is on. They share a row when there's room. All of it goes inside the scrolling area, so that the
// script can pass beneath it.

import { actionPill, button, centerGlyphs, glyphBadge, Menu, pill, pillSep } from './controls.js';
import { createActionCenter } from './action-center.js';

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
  const start = cell('fl-topbar-start', slot('document'), cell('fl-topbar-tabs', slot('tabs')));
  bar.append(start, exportHolder);
  return { bar, start, exportHolder, setExportActions };
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

  // Folded, the toggle moves up beside the tabs when the top row has room for it, which lets
  // the page move up too. Otherwise it keeps a row of its own.
  let topBar = null;
  const placeToggle = () => {
    if (!topBar) return;
    const { bar, start, exportHolder } = topBar;
    bar.classList.remove('fl-topbar-inline');
    if (!center.folded) return;
    const style = getComputedStyle(bar);
    const gap = parseFloat(style.columnGap) || 0;
    const room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // The start's natural width, which its own cell may have squeezed.
    start.style.width = 'max-content';
    const needed = start.offsetWidth + center.toggle.offsetWidth + exportHolder.offsetWidth + 2 * gap;
    start.style.width = '';
    bar.classList.toggle('fl-topbar-inline', needed <= room);
  };
  const center = createActionCenter({ onFold: placeToggle });
  center.set('write', {
    label: 'Formatting',
    pills: [styles, pill({ label: 'Topic' }, topics.root), pill({ label: 'Page break' }, pageBreak), pill({ label: 'Comments' }, comment), additions],
    onCollapse: () => topics.close(),
  });

  const root = document.createElement('div');
  root.className = 'fl-chrome';
  topBar = createTopBar(actions);
  topBar.bar.insertBefore(center.root, topBar.exportHolder);
  root.append(topBar.bar);
  // Only the width matters: the folded row changes the height, which needs no new check.
  let barWidth = 0;
  const resize = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === barWidth) return;
    barWidth = entry.contentRect.width;
    placeToggle();
  });
  resize.observe(topBar.bar);

  // The bundled font can replace a fallback after the badges were first measured.
  const recenter = () => centerGlyphs(root);
  document.fonts.ready.then(recenter);
  document.fonts.addEventListener('loadingdone', recenter);

  return {
    root,
    setExportActions: topBar.setExportActions,
    destroy() {
      document.fonts.removeEventListener('loadingdone', recenter);
      resize.disconnect();
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
    /** Registers the commands a tab shows in the action center, as a list of pills. */
    setActions(workspace, options) {
      center.set(workspace, options);
    },
    // Each tab shows its own commands, and Read has none.
    setWorkspace(workspace) {
      if (workspace !== 'write') topics.close();
      center.show(workspace);
    },
  };
}
