// The floating pills along the bottom: how the script is shown on the left, whatever the
// app adds on the right through the status-end slot.

import { button, foldingPill, icon, Menu, pill, pillSep } from './controls.js';

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
  let page = 1;
  let pages = 0;

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

  // Jumping between pages, for Read's Paged view: the page number can be typed, or stepped.
  const pageField = document.createElement('input');
  pageField.className = 'fl-page-field';
  pageField.type = 'text';
  pageField.inputMode = 'numeric';
  pageField.enterKeyHint = 'go';
  pageField.autocomplete = 'off';
  pageField.setAttribute('aria-label', 'Page');
  const pageTotal = document.createElement('span');
  pageTotal.className = 'fl-page-total';
  // What's typed in the box waits for Enter, unless it's left or abandoned.
  let typing = false;
  const showPage = () => {
    typing = false;
    pageSummary.textContent = String(page);
    pageField.value = String(page);
    pageField.size = Math.max(1, String(pages).length);
    pageTotal.textContent = `/ ${pages}`;
    previous.disabled = page <= 1;
    next.disabled = page >= pages;
  };
  const jump = () => {
    const wanted = Number.parseInt(pageField.value, 10);
    typing = false;
    if (Number.isFinite(wanted)) actions.goToPage(Math.min(pages, Math.max(1, wanted)));
    showPage();
  };
  pageField.addEventListener('focus', () => pageField.select());
  pageField.addEventListener('input', () => { typing = true; });
  pageField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jump();
      pageField.select();
    } else if (event.key === 'Escape' && pageField.value !== String(page)) {
      event.stopPropagation();
      showPage();
    }
  });
  pageField.addEventListener('change', jump);
  pageField.addEventListener('blur', showPage);
  const previous = button({ label: 'Previous page', icon: 'chevron-left', iconOnly: true, onClick: () => actions.goToPage(page - 1) });
  const next = button({ label: 'Next page', icon: 'chevron-right', iconOnly: true, onClick: () => actions.goToPage(page + 1) });
  // Folded, the button shows the page it's on, without the count.
  const pageSummary = document.createElement('span');
  const pagePill = foldingPill({
    label: 'Pages', icon: 'page-jump', title: 'Go to a page', cls: 'fl-pages-pill', summary: pageSummary,
    value: [pageField, pageTotal], actions: [previous, next],
  });
  pagePill.root.hidden = true;
  showPage();

  // In the dropdown the scale can be typed, and resetting gets a button of its own.
  const scaleField = document.createElement('input');
  scaleField.className = 'fl-page-field fl-scale-field';
  scaleField.type = 'text';
  scaleField.inputMode = 'numeric';
  scaleField.enterKeyHint = 'done';
  scaleField.autocomplete = 'off';
  scaleField.size = 3;
  scaleField.setAttribute('aria-label', 'Page scale, in percent');
  const scaleUnit = document.createElement('span');
  scaleUnit.className = 'fl-scale-unit';
  scaleUnit.textContent = '%';
  let scaleTyping = false;
  const applyTyped = () => {
    scaleTyping = false;
    const wanted = Number.parseInt(scaleField.value, 10);
    if (Number.isFinite(wanted)) actions.setScale(Math.min(SCALE_MAX, Math.max(SCALE_MIN, wanted)));
    scaleField.value = String(scale);
  };
  scaleField.addEventListener('focus', () => scaleField.select());
  scaleField.addEventListener('input', () => { scaleTyping = true; });
  scaleField.addEventListener('blur', () => {
    scaleTyping = false;
    scaleField.value = String(scale);
  });
  scaleField.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyTyped();
    scaleField.select();
  });
  scaleField.addEventListener('change', applyTyped);
  const reset = button({
    label: `Reset to ${SCALE_DEFAULT}%`,
    icon: 'scaling',
    iconOnly: true,
    cls: 'fl-scale-reset',
    onClick: () => actions.setScale(SCALE_DEFAULT),
  });
  // Folded, the button shows the scale beside its icon.
  const scaleSummary = document.createElement('span');
  const scalePill = foldingPill({
    label: 'Page scale', icon: 'zoom', summary: scaleSummary,
    value: [percent, scaleField, scaleUnit, reset], actions: [bigger, smaller],
  });

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
    scalePill.root,
    pagePill.root,
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
      scalePill.close();
      pagePill.close();
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
      const paging = workspace === 'read' ? readView === 'page' : workspace === 'write' && view === 'page';
      if (!paging) pagePill.close();
      pagePill.root.hidden = !paging;
    },
    /** Which page Read's Paged view is on, of how many. */
    setPage(current, total) {
      page = current;
      pages = total;
      pageSummary.textContent = String(page);
      if (!typing) showPage();
      else {
        pageTotal.textContent = `/ ${pages}`;
        previous.disabled = page <= 1;
        next.disabled = page >= pages;
      }
    },
    setScale(next) {
      scale = next;
      percent.textContent = `${scale}%`;
      percent.setAttribute('aria-label', `Page scale ${scale}%. Reset to ${SCALE_DEFAULT}%`);
      reset.disabled = scale === SCALE_DEFAULT;
      scaleSummary.textContent = `${scale}%`;
      if (!scaleTyping) scaleField.value = String(scale);
      bigger.disabled = scale >= SCALE_MAX;
      smaller.disabled = scale <= SCALE_MIN;
    },
    setStatus(text) {
      status.textContent = text;
      statusPill.hidden = !text;
    },
  };
}
