import { button, openModal, pill, pillSep, tabs } from '@flow/element/source';
import { parse, scriptTitle } from '@flow/core';
import { putDoc } from './store.js';
import { getProvider, providers } from './providers/index.js';
import { currentTheme, h, themePicker, toast } from './ui.js';

const AUTOSAVE_DELAY_MS = 300;
const SCALE_KEY = 'flow-scale';

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
          h('span', { class: 'card-title' }, provider.label),
          h('span', { class: 'card-text' }, provider.saveHint()),
          status.ok ? null : h('span', { class: 'badge' }, status.reason));
      }))],
      actions: [button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => finish(null) })],
    });
  });
}

// The tab lives in the address as #/edit/<id>?tab=outline or ?tab=read, so reloading or going
// back keeps it. Write is the default and adds nothing.
const TABS = ['Write', 'Outline', 'Read'];

const tabInAddress = () => {
  const tab = new URLSearchParams(location.hash.split('?')[1]).get('tab');
  return TABS.find((name) => name.toLowerCase() === tab) ?? 'Write';
};

const setTabInAddress = (tab) => {
  const [route] = location.hash.split('?');
  // Replacing the entry doesn't fire hashchange, which would reopen the script.
  history.replaceState(history.state, '', tab === 'Write' ? route : `${route}?tab=${tab.toLowerCase()}`);
};

const readScale = () => {
  try {
    return localStorage.getItem(SCALE_KEY);
  } catch {
    return null;
  }
};

export function renderEditor(root, doc) {
  const script = document.createElement('flow-script');
  const openTab = tabInAddress();
  script.setAttribute('workspace', openTab.toLowerCase());
  script.setAttribute('theme', currentTheme());
  const scale = readScale();
  if (scale) script.setAttribute('scale', scale);
  script.addEventListener('flow-scale', (event) => {
    try {
      localStorage.setItem(SCALE_KEY, event.detail.scale);
    } catch {
      // Private browsing can refuse storage; the scale still applies for this visit.
    }
  });
  script.value = doc.value;

  const name = h('span', { class: 'doc-name' });
  const date = h('span', { class: 'doc-date' });
  const where = h('span', { class: 'doc-where' });
  const state = h('span', { class: 'doc-state', role: 'status' });
  let saving = false;

  const refreshHeader = () => {
    name.textContent = doc.name;
    date.textContent = new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    where.textContent = getProvider(doc.provider)?.location(doc) ?? '';
    if (doc.value === doc.savedValue) state.textContent = 'Saved';
    else if (doc.savedValue === null) state.textContent = 'On this device only';
    else state.textContent = 'Unsaved changes';
  };

  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = null;
    return putDoc(doc).catch((err) => toast(`Couldn't autosave: ${err.message}`));
  };

  const applySaved = async (provider, result) => {
    Object.assign(doc, { name: result.name, ref: result.ref, provider: provider.id, savedValue: doc.value });
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
    if (!provider) return;
    const result = await provider.saveAs(doc);
    if (result) await applySaved(provider, result);
  });
  const save = async () => {
    const provider = getProvider(doc.provider);
    if (!provider) return saveAs();
    return guarded(async () => {
      const result = await saveExisting(provider);
      if (result) await applySaved(provider, result);
    })();
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (event.shiftKey) saveAs();
      else save();
    }
  };
  const onPageHide = () => { if (timer) persist(); };

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
  refreshHeader();

  script.exportActions = [
    { label: 'Save', title: 'Save (Ctrl/Cmd+S)', icon: 'save', attrs: { id: 'save' }, onClick: save },
    { label: 'Save as', title: 'Save as (Ctrl/Cmd+Shift+S)', icon: 'save-as', attrs: { id: 'save-as' }, onClick: saveAs },
  ];
  script.append(
    pill({ cls: 'fl-pill-tinted doc-pill', label: 'Document', attrs: { slot: 'document' } },
      button({ label: 'Home', title: 'Back to all scripts', icon: 'stack', iconOnly: true, href: '#/', cls: 'home-link' }),
      pillSep(),
      h('span', { class: 'doc' }, name, h('span', { class: 'doc-meta' }, date, where, state))),
    tabs({
      label: 'Workspace',
      attrs: { slot: 'tabs' },
      onSelect: (tab) => {
        script.setAttribute('workspace', tab.toLowerCase());
        setTabInAddress(tab);
      },
    }, [
      { label: 'Write', icon: 'write', selected: openTab === 'Write' },
      { label: 'Outline', icon: 'outline', title: 'Plan the script with acts, sequences and synopses', selected: openTab === 'Outline' },
      { label: 'Read', icon: 'read', title: 'The pages as they print, with editing off', selected: openTab === 'Read' },
    ]),
    pill({ label: 'Appearance', attrs: { slot: 'status-end' } }, themePicker({
      up: true,
      onChange: (theme) => script.setAttribute('theme', theme),
    })),
  );

  root.replaceChildren(h('div', { class: 'editor' }, script));

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', onPageHide);
    if (timer) persist();
  };
}
