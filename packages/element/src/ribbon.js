// The editing ribbon. Buttons keep editor focus by cancelling mousedown, so the
// selection and active-line state survive a click.

const STYLE_BUTTONS = [
  { style: 'bold', label: 'B', cls: 'fl-b', title: 'Bold (Ctrl/Cmd+B)' },
  { style: 'italic', label: 'I', cls: 'fl-i', title: 'Italic (Ctrl/Cmd+I)' },
  { style: 'underline', label: 'U', cls: 'fl-u', title: 'Underline (Ctrl/Cmd+U)' },
];

// Each badge shows what you could type by hand. Dialogue is the exception: Fountain
// has no marker for it, since any text under a character cue is dialogue.
const TYPE_GROUPS = [
  [
    { type: 'scene', icon: '.', label: 'Scene', title: 'Scene heading. Type . to force one.' },
    { type: 'transition', icon: '>', label: 'Transition', title: 'Transition. Type > to force one.' },
  ],
  [
    { type: 'character', icon: '@', label: 'Character', title: 'Character cue. Type @ to force one.' },
    { type: 'parenthetical', icon: '()', label: 'Paren', title: 'Parenthetical. Wrap it in ( ) under a character.' },
    { type: 'dialogue', icon: '“', label: 'Dialogue', title: 'Dialogue. No marker needed: it is any text under a character.' },
  ],
  [{ type: 'dual', icon: '^', label: 'Dual', title: 'Dual dialogue: place this speech beside the previous one. Type ^ after the name.' }],
  [
    { type: 'action', icon: '!', label: 'Action', title: 'Action. Type ! to force it.' },
    { type: 'centered', icon: '><', label: 'Centered', title: 'Centered text. Wrap it in > <.' },
    { type: 'lyrics', icon: '~', label: 'Lyrics', title: 'Lyrics. Type ~ at the start of the line.' },
  ],
  [
    { type: 'section-1', icon: '#', label: 'Act', title: 'Outline section, level 1. Type #. Not printed.' },
    { type: 'section-2', icon: '##', label: 'Sequence', title: 'Outline section, level 2. Type ##. Not printed.' },
    { type: 'synopsis', icon: '=', label: 'Synopsis', title: 'Synopsis. Type =. Not printed.' },
  ],
  [{ type: 'note', icon: '[[', label: 'Note', title: 'Note, shown as a comment bubble. Wrap it in [[ ]].' }],
  [{ type: 'boneyard', icon: '/*', label: 'Boneyard', title: 'Boneyard: cut text that stays in the file but never prints. Wrap it in /* */.' }],
];

const ICON_FONT = '"Courier Prime", "Courier New", Courier, monospace';

// Characters like . and ^ sit far from the middle of their line, so centering the
// text box isn't enough. This measures each glyph's ink and centers that instead.
function centerIcons(root) {
  const ctx = document.createElement('canvas').getContext('2d');
  const size = 100;
  ctx.font = `700 ${size}px ${ICON_FONT}`;
  for (const glyph of root.querySelectorAll('.fl-icon-glyph')) {
    const m = ctx.measureText(glyph.textContent);
    const dx = m.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    const dy = (m.fontBoundingBoxDescent - m.fontBoundingBoxAscent) / 2 - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    glyph.style.transform = `translate(${(dx / size).toFixed(3)}em, ${(dy / size).toFixed(3)}em)`;
  }
}

function button(label, title, { cls, icon } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = title;
  if (cls) b.className = cls;
  if (icon) {
    const badge = document.createElement('span');
    badge.className = 'fl-icon';
    badge.setAttribute('aria-hidden', 'true');
    const glyph = document.createElement('span');
    glyph.className = 'fl-icon-glyph';
    glyph.style.fontFamily = ICON_FONT;
    glyph.textContent = icon;
    badge.append(glyph);
    b.append(badge);
  }
  b.append(label);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

const newGroup = (parent) => {
  const g = document.createElement('div');
  g.className = 'fl-group';
  g.setAttribute('role', 'group');
  parent.append(g);
  return g;
};

export function createRibbon(actions) {
  const root = document.createElement('div');
  root.className = 'fl-ribbon';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Formatting');
  const pressed = new Map();
  const add = (group, b, key, onClick) => {
    b.addEventListener('click', onClick);
    if (key) {
      b.setAttribute('aria-pressed', 'false');
      pressed.set(key, b);
    }
    group.append(b);
  };

  const styles = newGroup(root);
  for (const s of STYLE_BUTTONS) add(styles, button(s.label, s.title, { cls: s.cls }), s.style, () => actions.emphasis(s.style));
  for (const types of TYPE_GROUPS) {
    const group = newGroup(root);
    for (const t of types) {
      const onClick = actions[t.type] ? () => actions[t.type]() : () => actions.setLineType(t.type);
      add(group, button(t.label, t.title, { icon: t.icon }), t.type, onClick);
    }
  }
  add(newGroup(root), button('Page break', 'Insert a page break. Type === on its own line.', { icon: '===' }), null, () => actions.pageBreak());
  const history = newGroup(root);
  const undo = button('Undo', 'Undo (Ctrl/Cmd+Z)');
  const redo = button('Redo', 'Redo (Ctrl/Cmd+Shift+Z)');
  add(history, undo, null, () => actions.undo());
  add(history, redo, null, () => actions.redo());

  const spacer = document.createElement('span');
  spacer.className = 'fl-spacer';
  root.append(spacer);

  const status = document.createElement('span');
  status.className = 'fl-status';
  status.setAttribute('role', 'status');
  root.append(status);

  const output = newGroup(root);
  const pageToggle = button('Page view', 'Show the script on standard pages, or as continuous text');
  add(output, pageToggle, 'page-view', () => actions.toggleView());
  output.append(createPdfMenu(actions));

  // Measure now, and again once the bundled font replaces any fallback.
  const recenter = () => centerIcons(root);
  recenter();
  document.fonts.ready.then(recenter);
  document.fonts.addEventListener('loadingdone', recenter);

  return {
    root,
    destroy() {
      document.fonts.removeEventListener('loadingdone', recenter);
      root.remove();
    },
    update(state) {
      for (const [key, b] of pressed) {
        if (key !== 'page-view') b.setAttribute('aria-pressed', String(state.type === key || state[key] === true));
      }
      undo.disabled = !state.canUndo;
      redo.disabled = !state.canRedo;
    },
    setView(view) {
      pageToggle.setAttribute('aria-pressed', String(view !== 'flow'));
    },
    setStatus(text) {
      status.textContent = text;
    },
  };
}

function createPdfMenu(actions) {
  const details = document.createElement('details');
  details.className = 'fl-menu';
  const summary = document.createElement('summary');
  summary.textContent = 'PDF ▾';
  const body = document.createElement('div');
  body.className = 'fl-menu-body';

  const options = actions.getOptions();
  const check = (key, label) => {
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = options[key];
    input.addEventListener('change', () => actions.setOption(key, input.checked));
    wrap.append(input, label);
    return wrap;
  };
  const paper = document.createElement('label');
  const select = document.createElement('select');
  for (const [value, label] of [['letter', 'US Letter'], ['a4', 'A4']]) select.add(new Option(label, value, false, options.paper === value));
  select.addEventListener('change', () => actions.setOption('paper', select.value));
  paper.append('Paper', select);

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Export PDF';
  go.addEventListener('click', () => {
    details.open = false;
    actions.exportPdf();
  });

  body.append(
    paper,
    check('titlePage', 'Title page'),
    check('sceneNumbers', 'Scene numbers'),
    check('boldScenes', 'Bold scene headings'),
    check('underlineScenes', 'Underline scene headings'),
    check('doubleSpaceScenes', 'Double space before scenes'),
    check('sceneContinued', 'Scene continued across pages'),
    check('pageNumbers', 'Page numbers'),
    go,
  );
  details.append(summary, body);
  return details;
}
