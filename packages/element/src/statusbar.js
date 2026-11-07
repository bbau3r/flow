// The floating pills along the bottom: how the script is shown on the left, whatever the
// app adds on the right through the status-end slot.

import { button, icon, Menu, pill, pillSep } from './controls.js';

export const SCALE_MIN = 50;
export const SCALE_MAX = 200;
export const SCALE_STEP = 10;
const SCALE_DEFAULT = 100;

const VIEWS = [
  { value: 'flow', icon: 'seamless', label: 'Seamless', title: 'Continuous text, with no pages' },
  { value: 'page', icon: 'paged', label: 'Paged', title: 'Editable standard script pages' },
  { value: 'source', icon: 'source', label: 'Fountain', title: 'The Fountain text itself, with nothing hidden or formatted' },
];

// Read shows the script as it prints, so only the views that look like the script.
const READ_VIEWS = [
  { value: 'flow', icon: 'seamless', label: 'Seamless', title: 'Continuous text, with no pages' },
  { value: 'page', icon: 'paged', label: 'Paged', title: 'Standard script pages, as they print' },
];

function viewMenu(views, current, onSelect) {
  return new Menu({
    up: true,
    sections: [{ items: views }],
    isChecked: (value) => value === current(),
    trigger: () => {
      const shown = views.find((v) => v.value === current());
      const name = document.createElement('span');
      name.className = 'fl-label fl-collapse';
      name.textContent = shown.label;
      return { label: `View: ${shown.label}`, content: [icon(shown.icon), name] };
    },
    onSelect,
  });
}

export function createStatusbar(actions) {
  let view = 'flow';
  let readView = 'page';
  let scale = SCALE_DEFAULT;

  const writeMenu = viewMenu(VIEWS, () => view, (value) => actions.setView(value));
  const readMenu = viewMenu(READ_VIEWS, () => readView, (value) => actions.setReadView(value));

  const percent = button({
    label: 'Reset page scale',
    title: `Reset to ${SCALE_DEFAULT}%`,
    iconOnly: true,
    cls: 'fl-scale',
    onClick: () => actions.setScale(SCALE_DEFAULT),
  });
  const zoom = (delta) => () => actions.setScale(scale + delta);
  const bigger = button({ label: 'Larger', title: 'Increase page scale', icon: 'plus', iconOnly: true, onClick: zoom(SCALE_STEP) });
  const smaller = button({ label: 'Smaller', title: 'Decrease page scale', icon: 'minus', iconOnly: true, onClick: zoom(-SCALE_STEP) });

  const undo = button({ label: 'Undo', title: 'Undo (Ctrl/Cmd+Z)', icon: 'undo', iconOnly: true, onClick: () => actions.undo() });
  const redo = button({ label: 'Redo', title: 'Redo (Ctrl/Cmd+Shift+Z)', icon: 'redo', iconOnly: true, onClick: () => actions.redo() });
  undo.disabled = true;
  redo.disabled = true;
  const history = pill({ label: 'History' }, undo, pillSep(), redo);

  const status = document.createElement('span');
  status.className = 'fl-status';
  status.setAttribute('role', 'status');
  const statusPill = pill({ label: 'Status' }, status);
  statusPill.hidden = true;

  const spacer = document.createElement('span');
  spacer.className = 'fl-spacer';

  const end = document.createElement('slot');
  end.name = 'status-end';

  const bar = document.createElement('div');
  bar.className = 'fl-statusbar';
  const viewPill = pill({ label: 'View' }, writeMenu.root);
  const readPill = pill({ label: 'Read view' }, readMenu.root);
  readPill.hidden = true;
  bar.append(
    viewPill,
    readPill,
    pill({ label: 'Page scale' }, percent, pillSep(), bigger, smaller),
    statusPill,
    spacer,
    history,
    end,
  );

  const root = document.createElement('footer');
  root.className = 'fl-footer';
  root.append(bar);

  return {
    root,
    destroy() {
      writeMenu.close();
      readMenu.close();
      root.remove();
    },
    update(state) {
      undo.disabled = !state.canUndo;
      redo.disabled = !state.canRedo;
    },
    // Write and Read each have their own views, and Outline has none. Read changes nothing
    // that could be undone.
    setView(next, workspace = 'write', nextRead = readView) {
      view = next;
      readView = nextRead;
      writeMenu.refresh();
      readMenu.refresh();
      if (workspace !== 'write') writeMenu.close();
      if (workspace !== 'read') readMenu.close();
      viewPill.hidden = workspace !== 'write';
      readPill.hidden = workspace !== 'read';
      history.hidden = workspace === 'read';
    },
    setScale(next) {
      scale = next;
      percent.textContent = `${scale}%`;
      percent.setAttribute('aria-label', `Page scale ${scale}%. Reset to ${SCALE_DEFAULT}%`);
      bigger.disabled = scale >= SCALE_MAX;
      smaller.disabled = scale <= SCALE_MIN;
    },
    setStatus(text) {
      status.textContent = text;
      statusPill.hidden = !text;
    },
  };
}
