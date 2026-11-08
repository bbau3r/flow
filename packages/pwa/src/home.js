import { newScript } from '@flow/core';
import { pill } from '@flow/element/source';
import { createDoc, deleteDoc, listDocs } from './store.js';
import { providers } from './providers/index.js';
import { h, themePicker, timeAgo, toast } from './ui.js';
import { flowMark } from './mark.js';

const edit = (doc) => { location.hash = `#/edit/${doc.id}`; };

async function startNew() {
  const doc = await createDoc({ name: 'Untitled Screenplay', value: newScript() });
  sessionStorage.setItem('flow-new-doc', doc.id);
  edit(doc);
}

async function openFrom(provider) {
  try {
    const file = await provider.open();
    if (!file) return;
    edit(await createDoc({ name: file.name, value: file.text.replace(/\r\n?/g, '\n'), provider: provider.id, ref: file.ref, saved: true }));
  } catch (err) {
    toast(err.message);
  }
}

function providerCard(provider) {
  const status = provider.status();
  return h('button', {
    type: 'button',
    class: 'card',
    disabled: !status.ok,
    'data-provider': provider.id,
    onclick: () => openFrom(provider),
  },
  h('span', { class: 'card-title' }, provider.label),
  h('span', { class: 'card-text' }, provider.description),
  status.ok ? null : h('span', { class: 'badge' }, status.reason));
}

function recentRow(doc, refresh) {
  const unsaved = doc.value !== doc.savedValue;
  const where = providers.find((p) => p.id === doc.provider)?.label ?? 'Not saved to a file';
  return h('li', { class: 'recent-row' },
    h('button', { type: 'button', class: 'recent-open', onclick: () => edit(doc) },
      h('span', { class: 'recent-name' }, doc.name),
      h('span', { class: 'recent-meta' }, `${where} · ${timeAgo(doc.updatedAt)}${unsaved ? ' · unsaved changes' : ''}`)),
    h('button', {
      type: 'button',
      class: 'recent-remove',
      'aria-label': `Remove ${doc.name} from this list`,
      title: 'Remove from this list',
      onclick: async () => {
        // Removing only forgets Flow's copy, which is the sole copy if nothing was saved.
        if (unsaved && !confirm(`"${doc.name}" has changes that aren't saved to a file. Remove it and lose them?`)) return;
        await deleteDoc(doc.id);
        refresh();
      },
    }, '×'));
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  document.getElementById('install')?.removeAttribute('hidden');
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.getElementById('install')?.setAttribute('hidden', '');
});

export async function renderHome(root) {
  const docs = await listDocs();
  const refresh = () => renderHome(root);
  const install = h('button', {
    type: 'button',
    id: 'install',
    class: 'plain',
    hidden: !installPrompt,
    onclick: async () => {
      await installPrompt?.prompt();
      installPrompt = null;
      install.hidden = true;
    },
  }, 'Install app');

  root.replaceChildren(h('div', { class: 'home' },
    h('header', { class: 'home-top' },
      // The mark stands in for the F, so the wordmark reads "Flow".
      h('span', { class: 'brand', role: 'img', 'aria-label': 'Flow' }, flowMark(), h('span', { 'aria-hidden': 'true' }, 'low')),
      h('span', { class: 'spacer' }),
      navigator.onLine ? null : h('span', { class: 'badge' }, 'Offline'),
      install,
      pill({ label: 'Appearance' }, themePicker())),
    h('main', {},
      h('h1', {}, 'Write your screenplay'),
      h('section', { 'aria-labelledby': 'start-heading' },
        h('h2', { id: 'start-heading' }, 'Start something new'),
        h('button', { type: 'button', class: 'card primary', id: 'new-script', onclick: startNew },
          h('span', { class: 'card-title' }, 'New script'),
          h('span', { class: 'card-text' }, 'Begins with a full title page. Keep what you need and delete the rest.'))),
      h('section', { 'aria-labelledby': 'open-heading' },
        h('h2', { id: 'open-heading' }, 'Open a script'),
        h('div', { class: 'cards' }, ...providers.map(providerCard))),
      docs.length
        ? h('section', { 'aria-labelledby': 'recent-heading' },
          h('h2', { id: 'recent-heading' }, 'Recent'),
          h('ul', { class: 'recent' }, ...docs.map((doc) => recentRow(doc, refresh))))
        : null)));
}
