// The floating pills along the bottom: how the script is shown on the left, whatever the
// app adds on the right through the status-end slot.

import { button, icon, Menu, pill, pillSep } from './controls.js';

export const SCALE_MIN = 50;
export const SCALE_MAX = 200;
const SCALE_STEP = 10;
const SCALE_DEFAULT = 100;

const VIEWS = [
  { value: 'flow', icon: 'seamless', label: 'Seamless', title: 'Continuous text, with no pages' },
  { value: 'page', icon: 'paged', label: 'Paged', title: 'Editable standard script pages' },
  { value: 'source', icon: 'source', label: 'Fountain', title: 'The Fountain text itself, with nothing hidden or formatted' },
  { value: 'preview', icon: 'preview', label: 'Preview', title: 'The pages as they print. Editing is off.' },
];

export function createStatusbar(actions) {
  let view = 'page';
  let scale = SCALE_DEFAULT;

  const viewMenu = new Menu({
    up: true,
    sections: [{ items: VIEWS }],
    isChecked: (value) => value === view,
    trigger: () => {
      const current = VIEWS.find((v) => v.value === view);
      const name = document.createElement('span');
      name.className = 'fl-label fl-collapse';
      name.textContent = current.label;
      return { label: `View: ${current.label}`, content: [icon(current.icon), name] };
    },
    onSelect: (value) => actions.setView(value),
  });

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
  bar.append(
    pill({ label: 'View' }, viewMenu.root),
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
      viewMenu.close();
      root.remove();
    },
    update(state) {
      undo.disabled = !state.canUndo;
      redo.disabled = !state.canRedo;
    },
    setView(next) {
      view = next;
      viewMenu.refresh();
      history.hidden = view === 'preview';
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
