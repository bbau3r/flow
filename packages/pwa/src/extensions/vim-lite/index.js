// Vim lite, as an extension: everything here goes through the extension API, like any other
// extension would, and the editor knows nothing of Vim. Each open script gets its own engine
// (vim.js), its keys, and a widget beside undo and redo showing the mode and the last command.

import { button } from '@flow/element/source';
import { createVim, MODE_LABELS } from './vim.js';

// The widget sits inside the editor's shadow root, so its look comes with it, from the tokens.
const WIDGET_CSS = `
.vim-widget { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.fl-widget .fl-btn.vim-mode {
  min-width: 5.6em; padding-inline: 10px;
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; font-variant-numeric: tabular-nums;
  background: var(--flow-accent); color: var(--flow-accent-ink);
}
.fl-widget .fl-btn.vim-mode[data-mode="insert"] { background: var(--flow-secondary); color: var(--flow-secondary-ink); }
.fl-widget .fl-btn.vim-mode[data-mode^="visual"] { background: var(--flow-warning); color: var(--flow-paper); }
.fl-widget .fl-btn.vim-mode[data-mode="search"] { background: var(--flow-success); color: var(--flow-paper); }
.fl-widget .fl-btn.vim-mode:hover { filter: brightness(1.08); }
.vim-keys {
  min-width: 2ch; padding: 0 2px 0 8px;
  font-family: "Courier Prime", "Courier New", Courier, monospace; font-weight: 700; white-space: pre;
}
.vim-keys:empty { display: none; }
.vim-keys[data-pending] { color: var(--flow-accent); }
.vim-action { max-width: 16em; overflow: hidden; padding: 0 10px 0 6px; color: var(--flow-muted); text-overflow: ellipsis; white-space: nowrap; }
.vim-action:empty { display: none; }
@container (max-width: 600px) {
  .vim-action { display: none; }
}
`;

function createWidget(onToggle) {
  const mode = button({ label: 'Vim mode', title: 'Switch between Normal and Insert', text: MODE_LABELS.normal, cls: 'vim-mode', onClick: onToggle });
  const keys = document.createElement('span');
  keys.className = 'vim-keys';
  const action = document.createElement('span');
  action.className = 'vim-action';
  const root = document.createElement('span');
  root.className = 'vim-widget';
  root.append(mode, keys, action);
  return {
    root,
    show(status) {
      mode.textContent = MODE_LABELS[status.mode];
      mode.dataset.mode = status.mode;
      mode.setAttribute('aria-label', `Vim mode: ${MODE_LABELS[status.mode].toLowerCase()}`);
      keys.textContent = status.keys;
      keys.toggleAttribute('data-pending', status.pending);
      action.textContent = status.action;
    },
  };
}

export function activate(flow) {
  const open = new Set();

  flow.onEditor((script) => {
    const options = () => ({
      startMode: flow.settings.get('startMode'),
      chord: flow.settings.get('chord'),
      blockCursor: flow.settings.get('blockCursor'),
    });
    const widget = createWidget(() => vim.toggleMode());
    const vim = createVim({ options, onStatus: (status) => widget.show(status) });
    widget.show({ mode: vim.mode, keys: '', pending: false, action: '' });
    const removeKeys = script.addEditorKeys(vim);
    let removeWidget = null;
    const placeWidget = () => {
      removeWidget?.();
      removeWidget = flow.settings.get('widget')
        ? script.addWidget({ node: widget.root, place: 'bottom-end', label: 'Vim', tabs: ['write'], css: WIDGET_CSS })
        : null;
    };
    placeWidget();
    const entry = { vim, placeWidget };
    open.add(entry);
    return () => {
      open.delete(entry);
      removeKeys();
      removeWidget?.();
    };
  });

  flow.settings.onChange((key) => {
    for (const entry of open) {
      if (key === 'widget') entry.placeWidget();
      else entry.vim.refresh();
    }
  });
}
