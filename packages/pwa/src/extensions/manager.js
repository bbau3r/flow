// The Extensions page of App settings: every extension Flow knows, apps and then themes, each
// with a switch to turn it on, a button that turns to its settings if it has any, and Remove for
// one added from a file. Add extension opens the file picker for a manifest and any code file it
// names, and asks whether the code is trusted before adding it. The guides to writing extensions
// are linked beside it.

import { button, icon, openModal, toggleSwitch } from '@flow/element/source';
import { addExtension, checkExtension, listExtensions, removeExtension, setEnabled } from './host.js';
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
        if (confirm(`Remove ${name}? Its settings, and anything it kept on this device, go with it.`)) removeExtension(id);
      },
    }));
  }
  // Code from a file or the page says so, since it runs with everything Flow can do.
  const runsCode = source === 'code' || (source === 'added' && !!manifest.main);
  const meta = [`Version ${version}`, author && `by ${author}`, SOURCE_LABELS[source], runsCode && 'Runs its own code'].filter(Boolean).join(' · ');
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

// The guides to writing one, kept with the code.
const GUIDES = 'https://github.com/bbau3r/flow/blob/main/docs/extensions';

// Code from a file runs with everything Flow can do, so it's only added once the person says
// they trust it, every time, including updates. Resolves to whether they do.
function confirmTrust(manifest, codeFile) {
  return new Promise((resolve) => {
    let trusted = false;
    const size = codeFile.size < 1024 ? `${codeFile.size} bytes` : `${Math.round(codeFile.size / 1024)} KB`;
    const cancel = button({ label: 'Cancel', cls: 'fl-btn-outline', attrs: { id: 'trust-cancel' }, onClick: () => modal.close() });
    const modal = openModal(document.body, {
      title: 'Do you trust this extension?',
      icon: 'info',
      onClose: () => resolve(trusted),
      body: [
        h('p', { class: 'trust-name' }, h('strong', {}, manifest.name), ` ${manifest.version}`, manifest.author ? ` by ${manifest.author}` : ''),
        h('p', { class: 'trust-file' }, `Its code: ${codeFile.name}, ${size}`),
        h('p', { class: 'trust-warning', role: 'alert' },
          'This extension runs its own code inside Flow, with everything Flow can do: it can read and change your scripts, and the files and accounts Flow is connected to on this device. Flow can’t check what the code does. Only add it if it comes from someone you trust.'),
      ],
      actions: [
        cancel,
        button({ label: 'Trust and add', cls: 'fl-btn-primary', attrs: { id: 'trust-add' }, onClick: () => { trusted = true; modal.close(); } }),
      ],
    });
    // Not trusting is the safe choice, so it's the one a quick Enter makes.
    cancel.focus();
  });
}

// Adding goes straight to the system's file picker, for a manifest, and its code file when it
// has one. What's wrong shows under the button; once it's added, App settings reopens with it.
function addControls() {
  const message = h('p', { class: 'ext-add-error', role: 'alert' });
  const file = h('input', { type: 'file', accept: '.json,.js,.mjs,application/json,text/javascript', multiple: true, hidden: true, 'aria-label': 'Extension files' });
  file.addEventListener('change', async () => {
    const chosen = [...(file.files ?? [])];
    file.value = '';
    if (!chosen.length) return;
    message.textContent = '';
    const manifests = chosen.filter((each) => /\.json$/i.test(each.name));
    const named = manifests[0]?.name ?? chosen[0].name;
    try {
      if (manifests.length !== 1) throw new Error('Choose one manifest, a .json file, and its code file with it if it has one.');
      const json = await manifests[0].text();
      const manifest = checkExtension(json);
      const scripts = chosen.filter((each) => each !== manifests[0]);
      let code = null;
      if (manifest.main) {
        const codeFile = scripts.find((each) => each.name === manifest.main);
        if (!codeFile) throw new Error(`This app’s code is in ${manifest.main}. Choose it together with the manifest.`);
        if (!(await confirmTrust(manifest, codeFile))) return;
        code = await codeFile.text();
      } else if (scripts.length) {
        throw new Error('This manifest names no code file. Give it a "main", such as "index.js", to add code with it.');
      }
      await addExtension(json, { code });
      toast(`Added ${manifest.name}. Turn it on when you’re ready.`);
    } catch (err) {
      message.textContent = `${named}: ${err.message}`;
    }
  });
  const add = button({ label: 'Add extension', icon: 'upload', cls: 'fl-btn-primary', attrs: { id: 'add-extension' }, onClick: () => file.click() });
  return { control: [add, file], message };
}

const guide = (label, page) => button({
  label,
  title: `${label}, on GitHub`,
  icon: 'info',
  cls: 'fl-btn-outline',
  href: `${GUIDES}/${page}`,
  attrs: { target: '_blank', rel: 'noopener', 'data-guide': page },
});

/** The Extensions section for App settings. `panel()` is the open panel, for turning pages. */
export function extensionsSection(panel) {
  const all = listExtensions();
  const group = (kind) => all.filter(({ manifest }) => manifest.kind === kind).map((entry) => property(entry, panel));
  const apps = group('app');
  const themes = group('theme');
  const none = (label) => [{ label, description: 'Add one below.', control: null }];
  const adding = addControls();
  return {
    id: 'extensions',
    label: 'Extensions',
    icon: 'extensions',
    topics: [
      { label: 'Apps', properties: apps.length ? apps : none('No app extensions') },
      { label: 'Themes', properties: themes.length ? themes : none('No theme extensions') },
      {
        label: 'Add Custom',
        properties: [
          {
            label: 'Add extension',
            keywords: 'install add import json file extension theme',
            description: 'Choose an extension’s manifest, a .json file, and its code file with it if it has one. Flow checks it, asks whether you trust any code, and adds it turned off.',
            control: adding.control,
            below: adding.message,
          },
          {
            label: 'Writing extensions',
            keywords: 'write make author documentation guide help json manifest theme app',
            description: 'How to make a theme, with its colors; how an app extension works; and how to add a cloud source.',
            control: [guide('Themes guide', 'themes.md'), guide('Apps guide', 'apps.md'), guide('Sources guide', 'sources.md')],
          },
        ],
      },
    ],
  };
}
