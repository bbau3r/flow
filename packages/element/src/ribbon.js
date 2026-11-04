// What sits above the script: the top row, which an app fills through named slots, and
// the formatting row, which follows the line the cursor is on. Both go inside the
// scrolling area, so that the script can pass beneath them.

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
    { value: 'parenthetical', glyph: '()', label: 'Paren', title: 'Parenthetical. Wrap it in ( ) under a character.' },
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
  const tabsCell = cell('fl-topbar-center', slot('tabs'));
  bar.append(cell('fl-topbar-start', slot('document')), tabsCell, exportHolder);
  return { bar, tabsCell, setExportActions };
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
    collapse: true,
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
    collapse: true,
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
  }, () => actions.dual());
  const additions = pill({ label: 'Topic options' }, dual);
  additions.hidden = true;

  const row = document.createElement('div');
  row.className = 'fl-ribbon';
  row.setAttribute('role', 'toolbar');
  row.setAttribute('aria-label', 'Formatting');
  row.append(
    styles,
    pill({ label: 'Page break' }, pageBreak),
    pill({ label: 'Comments' }, comment),
    pill({ label: 'Topic' }, topics.root),
    additions,
  );

  const root = document.createElement('div');
  root.className = 'fl-chrome';
  const topBar = createTopBar(actions);
  root.append(topBar.bar, row);

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
    // Preview is only for reading, so nothing that edits or changes tab stays on show.
    setView(view) {
      const previewing = view === 'preview';
      row.hidden = previewing;
      topBar.tabsCell.hidden = previewing;
      if (previewing) topics.close();
    },
  };
}
