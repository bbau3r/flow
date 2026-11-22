// The home page: the wordmark, a search of the recent scripts and the app settings along the
// top, then a shelf of sheets. New and Open come first, then a sheet for each cloud provider
// an extension adds, then every recent script, each shown by its own title page, wrapping onto
// as many rows as it takes.

import { parse } from '@flow/core';
import { button, icon, searchField } from '@flow/element/source';
import { createDoc, deleteDoc, listDocs } from './store.js';
import { ensureConnected, providers, sourceOf, sourceRecord, SOURCE_KINDS } from './providers/index.js';
import { localProvider } from './providers/local.js';
import { h, timeAgo, toast } from './ui.js';
import { flowMark } from './mark.js';
import { openAppSettings } from './app-settings.js';
import { scriptFromDefaults } from './defaults.js';

// A title page never runs this long, and reading no further keeps long scripts quick.
const COVER_LINES = 80;

const edit = (doc) => { location.hash = `#/edit/${doc.id}`; };

async function startNew() {
  const doc = await createDoc({ name: 'Untitled Screenplay', value: scriptFromDefaults() });
  sessionStorage.setItem('flow-new-doc', doc.id);
  edit(doc);
}

async function openFrom(provider) {
  try {
    if (!(await ensureConnected(provider))) return;
    const file = await provider.open();
    if (!file) return;
    edit(await createDoc({ name: file.name, value: file.text.replace(/\r\n?/g, '\n'), provider: provider.id, source: sourceRecord(provider), ref: file.ref, saved: true }));
  } catch (err) {
    toast(err.message);
  }
}

// The fields of a script's title page, as lists of lines.
function titleFields(value) {
  const parsed = parse(value.split('\n', COVER_LINES).join('\n'));
  const fields = {};
  for (const entry of parsed.titlePage) {
    fields[entry.key] = entry.lines.map((i) => parsed.lines[i].text.trim()).filter(Boolean);
  }
  return fields;
}

const lines = (cls, list = []) => (list.length ? h('span', { class: cls }, ...list.map((text) => h('span', {}, text))) : null);

// A small drawing of the title page, laid out as it prints: title, credit and authors in the
// middle, contact at the bottom left and the draft date at the bottom right.
function cover(doc) {
  const fields = titleFields(doc.value);
  const title = fields.title?.length ? fields.title : [doc.name];
  const authors = [...(fields.author ?? []), ...(fields.authors ?? [])];
  return h('span', { class: 'cover fl-paper', 'aria-hidden': 'true' },
    h('span', { class: 'cover-middle' },
      lines('cover-title', title),
      lines('cover-credit', fields.credit),
      lines('cover-author', authors),
      lines('cover-source', fields.source)),
    h('span', { class: 'cover-foot' },
      lines('cover-contact', fields.contact) ?? h('span'),
      lines('cover-date', fields['draft date'])));
}

function recentCard(doc, refresh) {
  const unsaved = doc.value !== doc.savedValue;
  // Where it lives: Temp, Local, or Cloud and the service's name.
  const where = sourceOf(doc).label;
  const card = h('li', { class: 'tile recent-row' },
    h('button', { type: 'button', class: 'recent-open', title: `Open ${doc.name}`, onclick: () => edit(doc) },
      cover(doc),
      h('span', { class: 'tile-label recent-name' }, doc.name),
      h('span', { class: 'recent-meta' }, timeAgo(doc.updatedAt)),
      h('span', { class: 'recent-meta recent-source' }, unsaved && doc.provider ? `${where} · unsaved changes` : where)),
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
    }, icon('close')));
  card.dataset.search = `${doc.name}\n${doc.value.split('\n', COVER_LINES).join('\n')}`.toLowerCase();
  return card;
}

// Open goes straight to this device's files.
function openTile() {
  const status = localProvider.status();
  return h('li', { class: 'tile' },
    h('button', {
      type: 'button',
      class: 'tile-button',
      id: 'open-script',
      'data-provider': localProvider.id,
      disabled: !status.ok,
      onclick: () => openFrom(localProvider),
    },
    h('span', { class: 'tile-face tile-open fl-paper' }, icon('folder')),
    h('span', { class: 'tile-label' }, 'Open'),
    h('span', { class: 'recent-meta' }, `From ${localProvider.label.toLowerCase()}`)));
}

// Each cloud provider an extension adds has a tile of its own beside Open, with its icon, that
// connects if it needs to and then opens from it.
function cloudTile(provider) {
  const status = provider.status();
  return h('li', { class: 'tile' },
    h('button', {
      type: 'button',
      class: 'tile-button',
      'data-provider': provider.id,
      title: provider.description,
      disabled: !status.ok,
      onclick: () => openFrom(provider),
    },
    h('span', { class: 'tile-face tile-open fl-paper' }, icon(provider.icon ?? 'folder')),
    h('span', { class: 'tile-label' }, provider.label),
    h('span', { class: 'recent-meta' }, SOURCE_KINDS.cloud),
    status.ok ? null : h('span', { class: 'badge' }, status.reason)));
}

export async function renderHome(root) {
  const docs = await listDocs();
  const refresh = () => renderHome(root);

  const cards = docs.map((doc) => recentCard(doc, refresh));
  const rule = h('li', { class: 'shelf-rule', 'aria-hidden': 'true' });
  rule.hidden = !cards.length;
  const empty = h('p', { class: 'home-empty', role: 'status' });

  const { root: search } = searchField({ label: 'Search scripts', cls: 'home-search', onInput: (value) => {
    const text = value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      card.hidden = !!text && !card.dataset.search.includes(text);
      if (!card.hidden) shown += 1;
    }
    rule.hidden = !shown;
    empty.textContent = text && !shown ? `No scripts match “${value.trim()}”.` : '';
  } });

  root.replaceChildren(h('div', { class: 'home' },
    h('header', { class: 'home-top' },
      // The mark stands in for the F, so the wordmark reads "Flow".
      h('span', { class: 'brand', role: 'img', 'aria-label': 'Flow' }, flowMark(), h('span', { 'aria-hidden': 'true' }, 'low')),
      h('span', { class: 'spacer' }),
      navigator.onLine ? null : h('span', { class: 'badge' }, 'Offline'),
      docs.length ? search : null,
      button({ label: 'App settings', icon: 'settings', iconOnly: true, cls: 'home-settings', attrs: { id: 'app-settings' }, onClick: () => openAppSettings() })),
    h('main', {},
      h('h1', { class: 'visually-hidden' }, 'Your scripts'),
      h('ul', { class: 'shelf', 'aria-label': 'Scripts' },
        h('li', { class: 'tile' },
          h('button', { type: 'button', class: 'tile-button', id: 'new-script', onclick: startNew },
            h('span', { class: 'tile-face tile-new' }, icon('plus')),
            h('span', { class: 'tile-label' }, 'New'))),
        openTile(),
        ...providers.filter((provider) => provider.kind === 'cloud').map(cloudTile),
        rule,
        ...cards),
      empty)));
}
