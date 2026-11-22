// The Extensions page of App settings: every extension Flow knows, apps and then themes, each
// with a switch to turn it on, a button that turns to its settings if it has any, and Remove for
// one added from files. Add extension reads an app's folder and Add theme a theme's .json file; either
// asks whether code is trusted before adding it, and turns it on. An app added from a folder Flow
// can keep can be updated from it again. The guides to writing extensions
// are linked beside it.

import { button, icon, openModal, toggleSwitch } from '@flow/element/source';
import { addExtension, checkExtension, extensionFolder, folderName, hasSettingsPage, listExtensions, removeExtension, setEnabled } from './host.js';
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
  const hasSettings = kind === 'app' && (manifest.settings.length > 0 || hasSettingsPage(id));
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
  const folder = source === 'added' ? folderName(id) : '';
  if (folder) {
    actions.push(button({
      label: `Update ${name} from its folder`,
      title: `Read ${name} again from ${folder}, after changing its files`,
      icon: 'upload',
      cls: 'fl-btn-outline',
      attrs: { 'data-action': 'update', 'data-extension': id },
      onClick: () => updateFromFolder(id, name),
    }));
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
  const meta = [`Version ${version}`, author && `by ${author}`, folder ? `From the ${folder} folder` : SOURCE_LABELS[source], runsCode && 'Runs its own code'].filter(Boolean).join(' · ');
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
function confirmTrust(manifest, codeFiles) {
  return new Promise((resolve) => {
    let trusted = false;
    const bytes = codeFiles.reduce((total, each) => total + each.size, 0);
    const size = bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`;
    const names = codeFiles.map((each) => each.name).join(', ');
    const cancel = button({ label: 'Cancel', cls: 'fl-btn-outline', attrs: { id: 'trust-cancel' }, onClick: () => modal.close() });
    const modal = openModal(document.body, {
      title: 'Do you trust this extension?',
      icon: 'info',
      onClose: () => resolve(trusted),
      body: [
        h('p', { class: 'trust-name' }, h('strong', {}, manifest.name), ` ${manifest.version}`, manifest.author ? ` by ${manifest.author}` : ''),
        h('p', { class: 'trust-file' }, `Its code: ${names}, ${size}`),
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

// An app's files: its manifest.json and the .js files beside it, at its folder's top level.
const APP_FILE = /^manifest\.json$|\.m?js$/i;

// Reads an app's files from a folder Flow was given, as a handle.
async function filesInFolder(folder) {
  const files = [];
  for await (const [name, handle] of folder.entries()) {
    if (handle.kind === 'file' && APP_FILE.test(name)) files.push(await handle.getFile());
  }
  return files;
}

// A theme is one .json file, called anything.
async function addTheme(file) {
  const json = await file.text();
  const manifest = checkExtension(json);
  if (manifest.kind !== 'theme') throw new Error('That’s an extension, not a theme. Use Add extension, and choose its folder.');
  await addExtension(json);
  return manifest;
}

/**
 * Adds an app from its folder's files: manifest.json and the .js files beside it. `folder` is
 * kept, when Flow has a handle to it, so the app can be updated from there. Asks about code
 * before adding anything. Resolves to the manifest, or null when the person didn't trust it.
 */
async function addApp(chosen, { folder = null } = {}) {
  const manifestFile = chosen.find((each) => each.name.toLowerCase() === 'manifest.json');
  if (!manifestFile) throw new Error('This folder has no manifest.json at its top level.');
  const json = await manifestFile.text();
  const manifest = checkExtension(json);
  if (manifest.kind !== 'app') throw new Error('That’s a theme. Use Add theme, and choose its .json file.');
  // The main file first, then the rest by name, as the trust warning lists them.
  const scripts = chosen.filter((each) => /\.m?js$/i.test(each.name))
    .sort((a, b) => (b.name === manifest.main) - (a.name === manifest.main) || a.name.localeCompare(b.name));
  const files = {};
  if (manifest.main) {
    if (!scripts.some((each) => each.name === manifest.main)) throw new Error(`This app’s code starts in ${manifest.main}, which isn’t in the folder.`);
    if (!(await confirmTrust(manifest, scripts))) return null;
    for (const each of scripts) files[each.name] = await each.text();
  }
  await addExtension(json, { files, folder });
  return manifest;
}

// Add theme picks a theme's .json file; Add extension points to an app extension's folder. Browsers that can be
// given a folder, Chrome and Edge on a computer, keep it, so the app can be updated from it;
// others read the folder once, through a file input. What's wrong shows under the buttons; once
// something is added, App settings reopens with it.
function addControls() {
  const message = h('p', { class: 'ext-add-error', role: 'alert' });
  const report = async (what, work) => {
    message.textContent = '';
    try {
      const manifest = await work();
      if (manifest) toast(`Added ${manifest.name}, turned on.`);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      message.textContent = `${what}: ${err.message}`;
    }
  };

  const themeInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Theme file' });
  themeInput.addEventListener('change', () => {
    const [file] = themeInput.files ?? [];
    themeInput.value = '';
    if (file) report(file.name, () => addTheme(file));
  });

  // Without a way to keep a folder, a file input reads one: its files come with their path.
  const folderInput = h('input', { type: 'file', multiple: true, hidden: true, 'aria-label': 'App folder' });
  folderInput.webkitdirectory = true;
  folderInput.addEventListener('change', () => {
    const all = [...(folderInput.files ?? [])];
    folderInput.value = '';
    if (!all.length) return;
    const top = all.filter((each) => (each.webkitRelativePath || each.name).split('/').length <= 2 && APP_FILE.test(each.name));
    const name = (all[0].webkitRelativePath || '').split('/')[0] || 'Folder';
    report(name, () => addApp(top));
  });

  const pickFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      folderInput.click();
      return;
    }
    let folder = null;
    try {
      folder = await window.showDirectoryPicker({ id: 'flow-extension', mode: 'read' });
    } catch (err) {
      if (err?.name !== 'AbortError') message.textContent = err.message;
      return;
    }
    report(folder.name, async () => addApp(await filesInFolder(folder), { folder }));
  };

  const addAppButton = button({ label: 'Add extension', icon: 'folder', cls: 'fl-btn-outline', attrs: { id: 'add-extension' }, onClick: pickFolder });
  const addThemeButton = button({ label: 'Add theme', icon: 'palette', cls: 'fl-btn-outline', attrs: { id: 'add-theme' }, onClick: () => themeInput.click() });
  return { control: h('div', { class: 'ext-add-buttons' }, addAppButton, addThemeButton, themeInput, folderInput), message };
}

// Reads an extension again from the folder it came from, as after editing its files. Code asks
// to be trusted again.
async function updateFromFolder(id, name) {
  try {
    const folder = await extensionFolder(id);
    if (!folder) throw new Error('Flow no longer has this folder. Add it again with Add folder.');
    if ((await folder.queryPermission?.({ mode: 'read' })) !== 'granted' && (await folder.requestPermission?.({ mode: 'read' })) !== 'granted') {
      throw new Error(`Flow wasn’t allowed to read ${folder.name}.`);
    }
    const manifest = await addApp(await filesInFolder(folder), { folder });
    if (manifest) toast(`Updated ${manifest.name} from ${folder.name}.`);
  } catch (err) {
    toast(`${name}: ${err.message}`);
  }
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
            keywords: 'install add import json file folder extension theme app',
            description: 'Add extension points to an extension’s folder, holding its manifest.json and .js files. Add theme takes a theme’s .json file.',
            control: adding.control,
            below: adding.message,
            wide: true,
          },
          {
            label: 'Writing extensions',
            keywords: 'write make author documentation guide help json manifest theme app',
            description: 'How to make a theme, with its colors; how an app extension works; and how to add a cloud provider.',
            control: h('div', { class: 'ext-guides' }, guide('Themes guide', 'themes.md'), guide('Apps guide', 'apps.md'), guide('Sources guide', 'sources.md')),
            wide: true,
          },
        ],
      },
    ],
  };
}
