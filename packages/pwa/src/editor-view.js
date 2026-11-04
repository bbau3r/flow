import '@flow/element/source';
import { parse } from '@flow/core';
import { putDoc } from './store.js';
import { getProvider, providers } from './providers/index.js';
import { currentTheme, h, themePicker, toast } from './ui.js';

const AUTOSAVE_DELAY_MS = 300;

const titleOf = (value) => {
  const { lines, titlePage } = parse(value);
  const entry = titlePage.find((e) => e.key === 'title');
  return entry ? lines[entry.lines[0]].text.trim() : '';
};

// Asks where a script that isn't a file yet should go.
function chooseProvider() {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'save-dialog', 'aria-labelledby': 'save-heading' });
    const finish = (provider) => {
      dialog.close();
      dialog.remove();
      resolve(provider);
    };
    dialog.append(
      h('h2', { id: 'save-heading' }, 'Save to'),
      h('div', { class: 'cards' }, ...providers.map((provider) => {
        const status = provider.status();
        return h('button', { type: 'button', class: 'card', disabled: !status.ok, onclick: () => finish(provider) },
          h('span', { class: 'card-title' }, provider.label),
          h('span', { class: 'card-text' }, provider.saveHint()),
          status.ok ? null : h('span', { class: 'badge' }, status.reason));
      })),
      h('button', { type: 'button', class: 'plain', onclick: () => finish(null) }, 'Cancel'),
    );
    dialog.addEventListener('cancel', () => finish(null));
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function renderEditor(root, doc) {
  const script = document.createElement('flow-script');
  script.setAttribute('theme', currentTheme());
  // A whole page shrunk to fit a phone is too small to write on.
  if (window.matchMedia('(max-width: 700px)').matches) script.setAttribute('view', 'flow');
  script.value = doc.value;

  const name = h('span', { class: 'doc-name' });
  const state = h('span', { class: 'doc-state', role: 'status' });
  const where = h('span', { class: 'doc-where' });
  let saving = false;

  const refreshHeader = () => {
    name.textContent = doc.name;
    const location = getProvider(doc.provider)?.location(doc);
    where.textContent = location ? ` \u00B7 ${location}` : '';
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
    toast(result.ref.downloaded ? `Downloaded ${result.name}` : `Saved ${result.name}`);
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

  script.addEventListener('flow-change', (event) => {
    doc.value = event.detail.value;
    doc.updatedAt = Date.now();
    // A script nobody has saved yet takes its name from its title page.
    if (doc.savedValue === null) doc.name = titleOf(doc.value) || 'Untitled Screenplay';
    refreshHeader();
    clearTimeout(timer);
    timer = setTimeout(persist, AUTOSAVE_DELAY_MS);
  });

  // New scripts put the cursor below the title page, ready to write.
  if (sessionStorage.getItem('flow-new-doc') === doc.id) {
    sessionStorage.removeItem('flow-new-doc');
    script.addEventListener('flow-ready', () => script.scrollToLine(parse(doc.value).lines.length - 1), { once: true });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', onPageHide);
  refreshHeader();

  root.replaceChildren(h('div', { class: 'editor' },
    h('header', { class: 'editor-top' },
      h('a', { class: 'plain home-link', href: '#/' }, '← Home'),
      h('span', { class: 'doc' }, name, h('span', { class: 'doc-status' }, state, where)),
      h('span', { class: 'spacer' }),
      themePicker((theme) => script.setAttribute('theme', theme)),
      h('button', { type: 'button', class: 'plain', id: 'save-as', onclick: saveAs }, 'Save as'),
      h('button', { type: 'button', class: 'action', id: 'save', onclick: save }, 'Save')),
    script));

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', onPageHide);
    if (timer) persist();
  };
}
