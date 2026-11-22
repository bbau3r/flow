// The Extensions page of App settings: every extension Flow knows, apps and then themes, each
// with a switch to turn it on, a button that turns to its settings if it has any, and Remove for
// one added from a file. Add extension takes a JSON file, or its text pasted in.

import { button, icon, openModal, toggleSwitch } from '@flow/element/source';
import { addExtension, listExtensions, removeExtension, setEnabled } from './host.js';
import { sectionId } from './settings.js';
import { h, toast } from '../ui.js';

const SOURCE_LABELS = { 'built-in': 'Built in', added: 'Added from a file', code: 'Added by code' };

function swatches(manifest) {
  return h('span', { class: 'ext-swatches', 'aria-hidden': 'true' },
    ...Object.values(manifest.palettes).flatMap((palette) => ['light', 'dark'].map((shade) => {
      const colors = palette[shade];
      const dot = (color) => {
        const node = h('span', { class: 'ext-dot' });
        node.style.background = color ?? '';
        return node;
      };
      const swatch = h('span', { class: 'ext-swatch', title: `${palette.label}, ${shade}` }, dot(colors.accent), dot(colors.secondary));
      swatch.style.background = colors.paper ?? '';
      swatch.style.borderColor = colors.rule ?? '';
      return swatch;
    })));
}

function property({ manifest, source, enabled, error }, panel) {
  const { id, name, version, author, description, kind } = manifest;
  const hasSettings = kind === 'app' && manifest.settings.length > 0;
  let settings = null;
  const toggle = toggleSwitch({
    label: `Turn ${name} on`,
    checked: enabled,
    attrs: { 'data-extension': id },
    onChange: (on) => {
      setEnabled(id, on);
      if (settings) settings.disabled = !on;
      if (on && kind === 'theme') toast(`${name} is in the theme chooser now.`);
    },
  });
  const actions = [];
  if (hasSettings) {
    settings = button({
      label: `${name} settings`,
      title: `${name} settings. Turn it on to change them.`,
      icon: 'settings',
      cls: 'fl-btn-outline',
      attrs: { 'data-action': 'settings', 'data-extension': id },
      onClick: () => panel()?.show(sectionId(id)),
    });
    settings.disabled = !enabled;
    actions.push(settings);
  }
  if (source === 'added') {
    actions.push(button({
      label: `Remove ${name}`,
      title: `Remove ${name} from Flow`,
      icon: 'trash',
      cls: 'fl-btn-outline ext-remove',
      attrs: { 'data-action': 'remove', 'data-extension': id },
      onClick: () => {
        if (confirm(`Remove ${name}? Its settings go with it.`)) removeExtension(id);
      },
    }));
  }
  const meta = [`Version ${version}`, author && `by ${author}`, SOURCE_LABELS[source]].filter(Boolean).join(' · ');
  return {
    label: name,
    keywords: `extension ${kind} ${description}`,
    control: toggle,
    below: h('div', { class: 'ext-details', 'data-extension': id },
      h('span', { class: 'ext-meta' }, icon(manifest.icon), meta),
      description ? h('p', { class: 'ext-desc' }, description) : null,
      kind === 'theme' ? swatches(manifest) : null,
      error ? h('p', { class: 'ext-error', role: 'alert' }, error) : null,
      actions.length ? h('div', { class: 'ext-actions' }, ...actions) : null),
  };
}

export function openAddDialog() {
  const message = h('p', { class: 'ext-add-error', role: 'alert' });
  const pasted = h('textarea', { class: 'ext-paste', rows: '8', spellcheck: 'false', 'aria-label': 'Extension JSON', placeholder: '{ "id": "my-theme", "kind": "theme", … }' });
  const tryAdd = (json) => {
    try {
      const manifest = addExtension(json);
      modal.close();
      toast(`Added ${manifest.name}. Turn it on when you’re ready.`);
    } catch (err) {
      message.textContent = err.message;
    }
  };
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (chosen) tryAdd(await chosen.text());
  });
  const modal = openModal(document.body, {
    title: 'Add extension',
    icon: 'extensions',
    body: [
      h('p', { class: 'ext-add-note' }, 'An extension is a JSON file: a theme, or an app whose commands type text. Flow checks it before adding it, and it starts turned off.'),
      button({ label: 'Choose a file', icon: 'upload', cls: 'fl-btn-outline', attrs: { id: 'extension-file' }, onClick: () => file.click() }),
      file,
      h('label', { class: 'ext-paste-label' }, 'Or paste its JSON', pasted),
      message,
    ],
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() }),
      button({ label: 'Add', cls: 'fl-btn-primary', attrs: { id: 'extension-add' }, onClick: () => tryAdd(pasted.value) }),
    ],
  });
  return modal;
}

/** The Extensions section for App settings. `panel()` is the open panel, for turning pages. */
export function extensionsSection(panel) {
  const all = listExtensions();
  const group = (kind) => all.filter(({ manifest }) => manifest.kind === kind).map((entry) => property(entry, panel));
  const apps = group('app');
  const themes = group('theme');
  const none = (label) => [{ label, description: 'Add one below.', control: null }];
  return {
    id: 'extensions',
    label: 'Extensions',
    icon: 'extensions',
    topics: [
      { label: 'Apps', properties: apps.length ? apps : none('No app extensions') },
      { label: 'Themes', properties: themes.length ? themes : none('No theme extensions') },
      {
        label: 'Add Custom',
        properties: [{
          label: 'Add extension',
          keywords: 'install add import json file extension theme',
          description: 'Apps can add commands, tabs, places to open scripts from, and bubbles along the bottom of the editor. Themes add palettes to the theme chooser.',
          control: button({ label: 'Add extension', icon: 'plus', cls: 'fl-btn-primary', attrs: { id: 'add-extension' }, onClick: openAddDialog }),
        }],
      },
    ],
  };
}
