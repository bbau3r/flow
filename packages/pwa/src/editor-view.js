// The editor page, at #/edit/<id>: one script in a <flow-script>, with the app's parts around it.
// It fills the element's slots and Document menu, autosaves, saves to files through providers,
// and keeps the tab in the address. Extensions that are on reach the script from here: their
// tabs join Write, Outline and Read, their commands join the Document menu, and their editor
// hooks run on the script.

import { button, openModal, tabs } from '@flow/element/source';
import { parse, scriptTitle } from '@flow/core';
import { putDoc } from './store.js';
import { ensureConnected, getProvider, providers, sourceOf, sourceRecord, SOURCE_KINDS } from './providers/index.js';
import { currentTheme, h, themeControls, toast } from './ui.js';
import { openAppSettings } from './app-settings.js';
import { attachEditor, extensionCommands, extensionTabs, onExtensionsChange } from './extensions/host.js';
import { matchesShortcut, shortcutLabel } from './extensions/shortcuts.js';

const AUTOSAVE_DELAY_MS = 300;
const SCALE_KEY = 'flow-scale';
const TEXT_WIDTH_KEY = 'flow-text-width';
// Shortcuts as each system writes them.
const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const SAVE_KEY = MAC ? '⌘S' : 'Ctrl+S';
const SAVE_AS_KEY = MAC ? '⇧⌘S' : 'Ctrl+Shift+S';

// Asks where a script that isn't a file yet should go. With only one place available
// there's nothing to ask, so the browser's own save dialog comes up straight away.
function chooseProvider() {
  const usable = providers.filter((provider) => provider.status().ok);
  if (usable.length === 1) return Promise.resolve(usable[0]);
  return new Promise((resolve) => {
    let chosen = null;
    const finish = (provider) => {
      chosen = provider;
      modal.close();
    };
    const modal = openModal(document.body, {
      title: 'Save to',
      onClose: () => resolve(chosen),
      body: [h('div', { class: 'cards' }, ...providers.map((provider) => {
        const status = provider.status();
        return h('button', { type: 'button', class: 'card', disabled: !status.ok, onclick: () => finish(provider) },
          h('span', { class: 'card-kind' }, SOURCE_KINDS[provider.kind]),
          h('span', { class: 'card-title' }, provider.label),
          h('span', { class: 'card-text' }, provider.saveHint()),
          status.ok ? null : h('span', { class: 'badge' }, status.reason));
      }))],
      actions: [button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => finish(null) })],
    });
  });
}

// The tabs: Flow's own, then each one an extension adds, named in the address by its
// extension's id and its own.
const OWN_TABS = [
  { id: 'write', label: 'Write', icon: 'write' },
  { id: 'outline', label: 'Outline', icon: 'outline', title: 'Plan the script with acts, sequences and synopses' },
  { id: 'read', label: 'Read', icon: 'read', title: 'The pages as they print, with editing off' },
];

const tabList = () => [
  ...OWN_TABS,
  ...extensionTabs().map((tab) => ({
    id: `${tab.extension.id}-${tab.id}`,
    label: tab.label,
    icon: tab.icon || tab.extension.icon,
    title: tab.title,
    render: tab.render,
  })),
];

// The tab lives in the address as #/edit/<id>?tab=outline or ?tab=read, so reloading or going
// back keeps it. Write is the default and adds nothing.
const tabInAddress = () => {
  const tab = new URLSearchParams(location.hash.split('?')[1]).get('tab');
  return tabList().find(({ id }) => id === tab)?.id ?? 'write';
};

const setTabInAddress = (id) => {
  const [route] = location.hash.split('?');
  // Replacing the entry doesn't fire hashchange, which would reopen the script.
  history.replaceState(history.state, '', id === 'write' ? route : `${route}?tab=${encodeURIComponent(id)}`);
};

const readStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const store = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the choice still applies for this visit.
  }
};

export function renderEditor(root, doc) {
  const script = document.createElement('flow-script');
  script.setAttribute('workspace', tabInAddress());
  script.setAttribute('theme', currentTheme());
  const scale = readStored(SCALE_KEY);
  if (scale) script.setAttribute('scale', scale);
  script.addEventListener('flow-scale', (event) => store(SCALE_KEY, event.detail.scale));
  // Wide or narrow text is a choice for this device, like the scale.
  if (readStored(TEXT_WIDTH_KEY) === 'wide') script.setAttribute('text-width', 'wide');
  script.addEventListener('flow-text-width', (event) => store(TEXT_WIDTH_KEY, event.detail.textWidth));
  script.value = doc.value;

  const name = h('span', { class: 'doc-name' });
  const date = h('span', { class: 'doc-date' });
  const where = h('span', { class: 'doc-where' });
  const state = h('span', { class: 'doc-state', role: 'status' });
  let saving = false;

  const refreshHeader = () => {
    name.textContent = doc.name;
    date.textContent = new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    // The source, Temp, Local or Cloud, and where in it when the provider can say.
    const source = sourceOf(doc);
    const location = doc.provider ? getProvider(doc.provider)?.location(doc) : '';
    where.textContent = location ? `${source.label} · ${location}` : source.label;
    if (!doc.provider) state.textContent = 'Not in a file yet';
    else if (doc.value === doc.savedValue) state.textContent = 'Saved';
    else state.textContent = 'Unsaved changes';
  };

  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = null;
    return putDoc(doc).catch((err) => toast(`Couldn't autosave: ${err.message}`));
  };

  const applySaved = async (provider, result) => {
    Object.assign(doc, { name: result.name, ref: result.ref, provider: provider.id, source: sourceRecord(provider), savedValue: doc.value });
    await persist();
    refreshHeader();
    toast(result.ref.downloaded
      ? `Downloaded ${result.name}. This browser can\u2019t ask where to save, but Chrome and Edge can.`
      : `Saved ${result.name}`);
  };

  // A file changed elsewhere is only overwritten if the writer says so.
  const saveExisting = async (provider, options) => {
    try {
      return await provider.save(doc, options);
    } catch (err) {
      if (err.name !== 'ConflictError') throw err;
      if (!confirm(`${err.message}\n\nOverwrite it with this version?`)) return null;
      return saveExisting(provider, { force: true, target: err.target });
    }
  };

  const guarded = (action) => async () => {
    if (saving) return;
    saving = true;
    try {
      await action();
    } catch (err) {
      // The text is still safe in local storage, so say so rather than alarming anyone.
      toast(`${err.message} Your changes are kept on this device.`);
    } finally {
      saving = false;
      script.focus(); // keep writing without having to click back in
    }
  };

  const saveAs = guarded(async () => {
    const provider = await chooseProvider();
    if (!provider || !(await ensureConnected(provider))) return;
    const result = await provider.saveAs(doc);
    if (result) await applySaved(provider, result);
  });
  const save = async () => {
    const provider = getProvider(doc.provider);
    if (!provider) return saveAs();
    return guarded(async () => {
      if (!(await ensureConnected(provider))) return;
      const result = await saveExisting(provider);
      if (result) await applySaved(provider, result);
    })();
  };

  // An extension's command runs on this script, and anything it throws is told rather than lost.
  const runCommand = (command) => {
    try {
      const result = command.run({ script });
      if (result && typeof result.catch === 'function') result.catch((err) => toast(`${command.extension.name}: ${err.message}`));
    } catch (err) {
      toast(`${command.extension.name}: ${err.message}`);
    }
  };

  const onKeyDown = (event) => {
    const command = extensionCommands().find(({ shortcut }) => matchesShortcut(event, shortcut));
    if (command) {
      event.preventDefault();
      runCommand(command);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (event.shiftKey) saveAs();
      else save();
    }
  };
  const onPageHide = () => { if (timer) persist(); };
  const onTheme = (event) => script.setAttribute('theme', event.detail.theme);

  // Highlights belong to the script on this device, not to its file, so they don't make it unsaved.
  script.highlights = doc.highlights ?? [];
  script.addEventListener('flow-highlights', (event) => {
    doc.highlights = event.detail.highlights;
    persist();
  });

  script.addEventListener('flow-change', (event) => {
    doc.value = event.detail.value;
    doc.updatedAt = Date.now();
    // A script nobody has saved yet takes its name from its title page.
    if (doc.savedValue === null) doc.name = scriptTitle(parse(doc.value)) || 'Untitled Screenplay';
    refreshHeader();
    clearTimeout(timer);
    timer = setTimeout(persist, AUTOSAVE_DELAY_MS);
  });

  // New scripts open on the cover page with the title selected, ready to type over.
  if (sessionStorage.getItem('flow-new-doc') === doc.id) {
    sessionStorage.removeItem('flow-new-doc');
    script.addEventListener('flow-ready', () => {
      const title = parse(doc.value).lines[0];
      script.selectText(0, title.contentStart, title.contentEnd);
    }, { once: true });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('flow-theme', onTheme);
  refreshHeader();

  const ownMenu = [
    [{ label: 'Home', title: 'Back to all scripts', icon: 'home', attrs: { id: 'home' }, onClick: () => { location.hash = '#/'; } }],
    [
      { label: 'Save', title: 'Save (Ctrl/Cmd+S)', icon: 'save', shortcut: SAVE_KEY, attrs: { id: 'save' }, onClick: save },
      { label: 'Save as', title: 'Save as (Ctrl/Cmd+Shift+S)', icon: 'save-as', shortcut: SAVE_AS_KEY, attrs: { id: 'save-as' }, onClick: saveAs },
      'pdf',
    ],
    [
      { label: 'Theme', title: 'Palette, and light or dark', icon: 'palette', attrs: { id: 'theme' }, panel: { title: 'Theme', build: () => themeControls().root } },
      'project-settings',
      { label: 'App settings', title: 'Settings for Flow on this device', icon: 'settings', attrs: { id: 'app-settings' }, onClick: () => openAppSettings({ onClose: () => script.focus() }) },
    ],
  ];
  // Extensions' commands come last, as a group of their own.
  const drawMenu = () => {
    const commands = extensionCommands().map((command) => ({
      label: command.label,
      title: command.title || `${command.label} (${command.extension.name})`,
      icon: command.icon || command.extension.icon,
      shortcut: shortcutLabel(command.shortcut),
      attrs: { 'data-command': `${command.extension.id}.${command.id}` },
      onClick: () => runCommand(command),
    }));
    script.menuItems = commands.length ? [...ownMenu, commands] : ownMenu;
    drawCommandWidgets();
  };

  // A command can also be a button in the bars, at the place its `widget` names.
  let commandWidgets = [];
  const drawCommandWidgets = () => {
    for (const remove of commandWidgets) remove();
    commandWidgets = extensionCommands().filter((command) => command.widget).map((command) => script.addWidget({
      place: command.widget,
      label: command.label,
      title: command.title || command.label,
      icon: command.icon || command.extension.icon,
      cls: 'fl-command-widget',
      onClick: () => runCommand(command),
    }));
  };

  // Extension tabs are added to the element as they come and taken away as they go. Redrawing
  // leaves alone any that are still there, so a tab that's open stays open.
  const added = new Map();
  let shownTabs = [];
  let workspaceTabs = null;
  const drawTabs = () => {
    shownTabs = tabList();
    for (const [id, entry] of added) {
      if (!shownTabs.some((tab) => tab.id === id && tab.render === entry.render)) {
        added.delete(id);
        entry.remove();
      }
    }
    for (const tab of shownTabs.filter(({ render, id }) => render && !added.has(id))) {
      try {
        added.set(tab.id, { render: tab.render, remove: script.addWorkspace({ id: tab.id, render: tab.render }) });
      } catch (err) {
        toast(err.message);
      }
    }
    // A tab the element turned down isn't offered.
    shownTabs = shownTabs.filter((tab) => !tab.render || added.has(tab.id));
    const current = script.workspace;
    const node = tabs({
      label: 'Workspace',
      attrs: { slot: 'tabs' },
      onSelect: (label) => {
        const tab = shownTabs.find((each) => each.label === label);
        script.setAttribute('workspace', tab.id);
        setTabInAddress(tab.id);
      },
    }, shownTabs.map((tab) => ({ label: tab.label, icon: tab.icon, title: tab.title, selected: tab.id === current })));
    if (workspaceTabs) workspaceTabs.replaceWith(node);
    else script.append(node);
    workspaceTabs = node;
  };

  // The outline, or an extension's tab going away, can move the element to another tab itself.
  script.addEventListener('flow-workspace', (event) => {
    const { workspace } = event.detail;
    const tab = shownTabs.find(({ id }) => id === workspace);
    if (tab) workspaceTabs?.selectTab(tab.label);
    setTabInAddress(workspace);
  });
  script.append(h('span', { class: 'doc', slot: 'document' }, name, h('span', { class: 'doc-meta' }, date, where, state)));
  drawMenu();
  drawTabs();

  root.replaceChildren(h('div', { class: 'editor' }, script));
  const detach = attachEditor(script);
  const stopListening = onExtensionsChange((change) => {
    if (change.type === 'setting' || change.type === 'layout') return;
    drawMenu();
    drawTabs();
  });

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('flow-theme', onTheme);
    stopListening();
    detach();
    if (timer) persist();
  };
}
