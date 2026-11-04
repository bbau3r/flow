// The editing ribbon. Buttons keep editor focus by cancelling mousedown, so the
// selection and active-line state survive a click.

const STYLE_BUTTONS = [
  { style: 'bold', label: 'B', cls: 'fl-b', title: 'Bold (Ctrl/Cmd+B)' },
  { style: 'italic', label: 'I', cls: 'fl-i', title: 'Italic (Ctrl/Cmd+I)' },
  { style: 'underline', label: 'U', cls: 'fl-u', title: 'Underline (Ctrl/Cmd+U)' },
];

const TYPE_GROUPS = [
  [
    { type: 'scene', label: 'Scene', title: 'Scene heading' },
    { type: 'action', label: 'Action', title: 'Action' },
    { type: 'character', label: 'Character', title: 'Character cue' },
    { type: 'parenthetical', label: 'Paren', title: 'Parenthetical' },
    { type: 'dialogue', label: 'Dialogue', title: 'Dialogue' },
    { type: 'lyrics', label: 'Lyrics', title: 'Lyrics' },
    { type: 'transition', label: 'Transition', title: 'Transition' },
    { type: 'centered', label: 'Centered', title: 'Centered text' },
  ],
  [
    { type: 'section-1', label: '# Act', title: 'Outline section, level 1 (not printed)' },
    { type: 'section-2', label: '## Seq', title: 'Outline section, level 2 (not printed)' },
    { type: 'synopsis', label: '= Synopsis', title: 'Synopsis (not printed)' },
    { type: 'note', label: 'Note', title: 'Note (shows as a comment bubble)' },
  ],
];

function button(label, title, className) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  if (className) b.className = className;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

const separator = () => {
  const s = document.createElement('span');
  s.className = 'fl-sep';
  return s;
};

export function createRibbon(actions) {
  const root = document.createElement('div');
  root.className = 'fl-ribbon';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Formatting');
  const pressed = new Map();
  const add = (b, key, onClick) => {
    b.addEventListener('click', onClick);
    if (key) {
      b.setAttribute('aria-pressed', 'false');
      pressed.set(key, b);
    }
    root.append(b);
  };

  for (const s of STYLE_BUTTONS) add(button(s.label, s.title, s.cls), s.style, () => actions.emphasis(s.style));
  for (const group of TYPE_GROUPS) {
    root.append(separator());
    for (const t of group) add(button(t.label, t.title), t.type, () => actions.setLineType(t.type));
  }
  root.append(separator());
  add(button('Dual', 'Dual dialogue: place this speech beside the previous one'), 'dual', () => actions.dual());
  add(button('Page break', 'Insert a page break'), null, () => actions.pageBreak());
  root.append(separator());
  const undo = button('Undo', 'Undo (Ctrl/Cmd+Z)');
  const redo = button('Redo', 'Redo (Ctrl/Cmd+Shift+Z)');
  add(undo, null, () => actions.undo());
  add(redo, null, () => actions.redo());

  const spacer = document.createElement('span');
  spacer.className = 'fl-spacer';
  root.append(spacer);

  const status = document.createElement('span');
  status.className = 'fl-status';
  status.setAttribute('role', 'status');
  root.append(status);

  const pageToggle = button('Page view', 'Show the script on standard pages, or as continuous text');
  add(pageToggle, 'page-view', () => actions.toggleView());

  root.append(createPdfMenu(actions));

  return {
    root,
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
    check('pageNumbers', 'Page numbers'),
    go,
  );
  details.append(summary, body);
  return details;
}
