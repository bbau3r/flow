// The extension host: which extensions Flow knows, which are on, their settings, and what each
// one adds while it's on. It belongs to this device, like the theme, so it lives in local storage,
// with the code of apps added from files in IndexedDB.
//
// There are three ways an extension arrives. Built-in ones ship with Flow, each a manifest.json
// and, for an app, code that only uses the API below. Added ones come from files someone picks on
// the Extensions page: a theme, an app whose commands type text, or an app with code, whose
// manifest names the .js file it starts from as `main`, and which is only added once the person
// says they trust it. What someone adds starts turned on; what ships with Flow starts off. And code running on the page can register one with window.flowExtensions.register(manifest,
// activate).
//
// An app's activate(flow) gets this API, and may return a function that undoes whatever it did:
//
//   flow.manifest                   its checked manifest
//   flow.settings.get(key)          a setting's value, or its default
//   flow.settings.onChange(fn)      fn(key, value) after a setting changes; returns an off switch
//   flow.storage                    its own storage: get, set, delete and keys, all async
//   flow.ui                         Flow's controls, for code that can't import them
//   flow.toast(message)             a short message at the bottom of the screen
//   flow.addCommand(command)        { id, label, icon, title, shortcut, widget, run({ script }) },
//                                   in the Document menu, on its shortcut, and as a button in
//                                   the bars when `widget` names a place
//   flow.addTab(tab)                { id, label, icon, title, render(root, context) }, a tab
//                                   beside Write, Outline and Read; see <flow-script> addWorkspace
//   flow.addSource(provider)        a place to open and save scripts, as in providers/index.js;
//                                   one that connects gets Connect on the extension's settings page
//   flow.onEditor(fn)               fn(script) for each open <flow-script>, which can call its
//                                   addWidget and addEditorKeys; fn may return a cleanup
//
// Every add returns a function that takes it away again, and everything still added is taken
// away when the extension is turned off.

import {
  actionPill, addPalette, button, icon, iconSwitch, Menu, openModal, pill, pillSep, removePalette, searchField, tabs, toggleSwitch,
} from '@flow/element/source';
import { readManifest, settingValue } from './manifest.js';
import { clearExtensionData, deleteCode, extensionStorage, getCode, loadModule, putCode } from './code-store.js';
import { addProvider } from '../providers/index.js';
import { refreshTheme, toast } from '../ui.js';
import { BUILT_IN } from './built-in.js';

const STORE_KEY = 'flow-extensions';

// The controls code from a file can use, since it can't import Flow's own modules.
const UI = Object.freeze({ actionPill, button, icon, iconSwitch, Menu, openModal, pill, pillSep, searchField, tabs, toggleSwitch });

function readStore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY));
  } catch {
    // Unreadable or refused storage means nothing is on.
  }
  const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  return {
    enabled: object(saved?.enabled),
    settings: object(saved?.settings),
    hiddenInSettings: object(saved?.hiddenInSettings),
    added: Array.isArray(saved?.added) ? saved.added : [],
  };
}

const store = readStore();

function writeStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing can refuse storage; the choices last for this visit.
  }
}

// id -> { manifest, source: 'built-in' | 'added' | 'code', activate, active, error, starting }
const entries = new Map();
const listeners = new Set();
const editors = new Set();
// Palettes, and which extension added each, so that two can't fight over one name.
const paletteOwners = new Map();

// A listener added while one change is being told, such as a panel reopened by it, hears only
// the changes after it.
const emit = (change) => [...listeners].forEach((listener) => listener(change));

function add(manifest, source, activate = null) {
  entries.set(manifest.id, { manifest, source, activate, active: null, error: '', starting: null });
}

for (const { manifest, activate } of BUILT_IN) add(readManifest(manifest), 'built-in', activate);
for (const saved of store.added) {
  try {
    const manifest = readManifest(saved);
    if (!entries.has(manifest.id)) add(manifest, 'added');
  } catch {
    // A saved extension this version can't read is left in storage but not offered.
  }
}

/** Everything Flow knows, in order: built in first, then the rest by name. */
export function listExtensions() {
  const order = { 'built-in': 0, code: 1, added: 1 };
  return [...entries.values()]
    .sort((a, b) => order[a.source] - order[b.source] || a.manifest.name.localeCompare(b.manifest.name))
    .map(({ manifest, source, error }) => ({ manifest, source, error, enabled: isEnabled(manifest.id) }));
}

export const getExtension = (id) => listExtensions().find((entry) => entry.manifest.id === id) ?? null;

// Everything starts off, built in or not, until it's turned on.
export const isEnabled = (id) => store.enabled[id] === true;

/** Calls `listener({ type, id })` after anything changes; returns a function to stop. */
export function onExtensionsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Turns an extension on or off. Resolves once it has started, which code from a file takes a moment to do. */
export async function setEnabled(id, on) {
  const entry = entries.get(id);
  if (!entry) return;
  store.enabled[id] = !!on;
  writeStore();
  if (on) await activate(entry);
  else deactivate(entry);
  emit({ type: 'enabled', id });
}

/**
 * Checks an extension's manifest, from the text of its file, as Add extension would take it,
 * and returns it. Throws an error that says what's wrong.
 */
export function checkExtension(json) {
  const manifest = readManifest(json);
  const existing = entries.get(manifest.id);
  if (existing && existing.source !== 'added') throw new Error(`Flow already has an extension called "${manifest.id}".`);
  if (manifest.kind === 'app' && !manifest.main && !manifest.commands.length) {
    throw new Error('This app has nothing Flow can run. An app added from a file needs commands that type text, or code: a main file named in its manifest, chosen together with it. The Apps guide explains more.');
  }
  return manifest;
}

/**
 * Adds an extension from the text of its manifest, with `files`, its .js files by name, for an
 * app with code. Whoever calls this has already asked whether the code is trusted. A new one
 * starts turned on; an update stays as it was. Throws an error that says what's wrong.
 */
export async function addExtension(json, { files = {} } = {}) {
  const manifest = checkExtension(json);
  if (manifest.main && typeof files[manifest.main] !== 'string') throw new Error(`This app’s code starts in ${manifest.main}. Choose it together with the manifest.`);
  const existing = entries.get(manifest.id);
  if (existing) deactivate(existing);
  if (manifest.main) await putCode(manifest.id, { main: manifest.main, files });
  else if (existing?.manifest.main) await deleteCode(manifest.id);
  add(manifest, 'added');
  store.added = [...store.added.filter((saved) => saved?.id !== manifest.id), manifest];
  if (!existing) store.enabled[manifest.id] = true;
  writeStore();
  if (isEnabled(manifest.id)) await activate(entries.get(manifest.id));
  emit({ type: 'added', id: manifest.id });
  return manifest;
}

/** Forgets an extension that was added from a file, with its settings, code and data. */
export async function removeExtension(id) {
  const entry = entries.get(id);
  if (!entry || entry.source !== 'added') return;
  deactivate(entry);
  entries.delete(id);
  store.added = store.added.filter((saved) => saved?.id !== id);
  delete store.enabled[id];
  delete store.settings[id];
  delete store.hiddenInSettings[id];
  writeStore();
  await Promise.all([deleteCode(id), clearExtensionData(id)]).catch(() => {});
  emit({ type: 'removed', id });
}

// --- Settings ---

/** An app's settings, as { key: value }, with defaults for any not changed. */
export function settingsOf(id) {
  const entry = entries.get(id);
  const saved = store.settings[id] ?? {};
  return Object.fromEntries((entry?.manifest.settings ?? []).map((setting) => [setting.key, settingValue(setting, saved[setting.key])]));
}

export function setSetting(id, key, value) {
  const setting = entries.get(id)?.manifest.settings?.find((each) => each.key === key);
  if (!setting) return;
  const next = settingValue(setting, value);
  store.settings[id] = { ...store.settings[id], [key]: next };
  writeStore();
  emit({ type: 'setting', id, key, value: next });
}

/** Whether an app's settings get a section of their own in App settings. */
export const showsInSettings = (id) => store.hiddenInSettings[id] !== true;

export function setShowsInSettings(id, shown) {
  if (shown) delete store.hiddenInSettings[id];
  else store.hiddenInSettings[id] = true;
  writeStore();
  emit({ type: 'layout', id });
}

// --- Running ---

// Code from a file is loaded the first time it's turned on, which waits on IndexedDB and the
// module itself; anything else starts at once.
async function activate(entry) {
  if (entry.active) return;
  const { manifest } = entry;
  if (entry.source === 'added' && manifest.main && !entry.activate) {
    entry.starting ??= getCode(manifest.id).then((code) => {
      if (!code?.files?.[code.main]) throw new Error('Its code is missing. Add it again.');
      return loadModule(code);
    });
    try {
      entry.activate = await entry.starting;
    } catch (err) {
      console.error(err);
      entry.error = `It couldn’t start: ${err.message}`;
      return;
    } finally {
      entry.starting = null;
    }
    // Turned off, or replaced, while it loaded.
    if (entries.get(manifest.id) !== entry || !isEnabled(manifest.id) || entry.active) return;
  }
  start(entry);
}

function start(entry) {
  const { manifest } = entry;
  const active = { commands: new Set(), tabs: new Set(), sources: new Set(), editorHooks: new Set(), undo: [], attached: new Map() };
  entry.active = active;
  entry.error = '';
  if (manifest.kind === 'theme') {
    for (const [name, palette] of Object.entries(manifest.palettes)) {
      if (paletteOwners.has(name) || !addPalette(name, palette)) continue;
      paletteOwners.set(name, manifest.id);
      active.undo.push(() => {
        removePalette(name);
        paletteOwners.delete(name);
      });
    }
    refreshTheme();
    return;
  }

  const listed = (set, item) => {
    set.add(item);
    emit({ type: 'contributions', id: manifest.id });
    return () => {
      if (set.delete(item)) emit({ type: 'contributions', id: manifest.id });
    };
  };
  for (const command of manifest.commands) {
    active.commands.add({ ...command, run: ({ script }) => script?.insertText(command.insert) });
  }
  const api = Object.freeze({
    manifest,
    settings: Object.freeze({
      get: (key) => settingsOf(manifest.id)[key],
      onChange: (fn) => {
        const off = onExtensionsChange((change) => {
          if (change.type === 'setting' && change.id === manifest.id) fn(change.key, change.value);
        });
        active.undo.push(off);
        return off;
      },
    }),
    storage: Object.freeze(extensionStorage(manifest.id)),
    ui: UI,
    toast,
    addCommand: (command) => listed(active.commands, { ...command }),
    addTab: (tab) => listed(active.tabs, { ...tab }),
    addSource: (provider) => {
      // A source without an icon of its own shows the extension's, on its sheet on the home page.
      if (provider && provider.icon == null) provider.icon = manifest.icon;
      const remove = addProvider(provider);
      active.sources.add(provider);
      const take = () => {
        remove();
        active.sources.delete(provider);
      };
      active.undo.push(take);
      emit({ type: 'contributions', id: manifest.id });
      return () => {
        take();
        emit({ type: 'contributions', id: manifest.id });
      };
    },
    onEditor: (fn) => {
      active.editorHooks.add(fn);
      for (const script of editors) attachHook(active, fn, script);
      return () => {
        active.editorHooks.delete(fn);
        for (const script of editors) detachHook(active, fn, script);
      };
    },
  });
  if (entry.activate) {
    try {
      const undo = entry.activate(api);
      if (typeof undo === 'function') active.undo.push(undo);
    } catch (err) {
      console.error(err);
      entry.error = `It couldn’t start: ${err.message}`;
      deactivate(entry);
    }
  }
}

function deactivate(entry) {
  const { active } = entry;
  if (!active) return;
  entry.active = null;
  for (const [key, cleanup] of active.attached) {
    active.attached.delete(key);
    safely(cleanup);
  }
  for (const undo of active.undo.reverse()) safely(undo);
  if (entry.manifest.kind === 'theme') refreshTheme();
}

function safely(fn) {
  try {
    fn?.();
  } catch (err) {
    console.error(err);
  }
}

// Each editor hook runs once per open script, keyed by the pair.
const hookKeys = new WeakMap();
const keyFor = (fn, script) => {
  if (!hookKeys.has(fn)) hookKeys.set(fn, new WeakMap());
  const byScript = hookKeys.get(fn);
  if (!byScript.has(script)) byScript.set(script, {});
  return byScript.get(script);
};

function attachHook(active, fn, script) {
  const key = keyFor(fn, script);
  if (active.attached.has(key)) return;
  try {
    const cleanup = fn(script);
    active.attached.set(key, typeof cleanup === 'function' ? cleanup : null);
  } catch (err) {
    console.error(err);
  }
}

function detachHook(active, fn, script) {
  const key = keyFor(fn, script);
  if (!active.attached.has(key)) return;
  const cleanup = active.attached.get(key);
  active.attached.delete(key);
  safely(cleanup);
}

const activeEntries = () => [...entries.values()].filter((entry) => entry.active);

/** Commands from every extension that's on, as { extension, id, label, icon, title, shortcut, widget, run }. */
export const extensionCommands = () => activeEntries().flatMap((entry) => [...entry.active.commands].map((command) => ({ ...command, extension: entry.manifest })));

/** Tabs from every extension that's on, as { extension, id, label, icon, title, render }. */
/** The sources an extension has added while it's on, which its settings page lets connect. */
export const extensionSources = (id) => [...(entries.get(id)?.active?.sources ?? [])];

/** Whether an app has a settings page: settings of its own, or a source that connects. */
export const hasSettingsPage = (id) => {
  const entry = entries.get(id);
  return entry?.manifest.kind === 'app' && (entry.manifest.settings.length > 0 || extensionSources(id).some((source) => source.connection));
};

export const extensionTabs = () => activeEntries().flatMap((entry) => [...entry.active.tabs].map((tab) => ({ ...tab, extension: entry.manifest })));

/**
 * Lets every extension that's on reach a script that has opened, now and as they're turned on
 * later. Returns a function to call as the script closes.
 */
export function attachEditor(script) {
  editors.add(script);
  for (const entry of activeEntries()) {
    for (const fn of entry.active.editorHooks) attachHook(entry.active, fn, script);
  }
  return () => {
    editors.delete(script);
    for (const entry of activeEntries()) {
      for (const fn of entry.active.editorHooks) detachHook(entry.active, fn, script);
    }
  };
}

/**
 * Registers an extension from code: a manifest, checked as any other, and activate(flow).
 * Its on or off is kept like any other's; the code itself has to register on every visit.
 */
export function registerExtension(json, activateFn) {
  const manifest = readManifest(json);
  if (manifest.kind !== 'app') throw new Error('Only apps are registered from code; a theme is added as a file.');
  const existing = entries.get(manifest.id);
  if (existing && existing.source !== 'code') throw new Error(`Flow already has an extension called "${manifest.id}".`);
  if (existing) deactivate(existing);
  add(manifest, 'code', typeof activateFn === 'function' ? activateFn : null);
  if (isEnabled(manifest.id)) start(entries.get(manifest.id));
  emit({ type: 'added', id: manifest.id });
  return manifest;
}

/**
 * Turns on whatever was left on. Runs once, before the page shows: themes and built-in apps
 * start at once, so a palette is ready for the first paint, and code from files follows.
 */
export function startExtensions() {
  for (const entry of entries.values()) {
    if (isEnabled(entry.manifest.id)) activate(entry).then(() => { if (entry.error) emit({ type: 'error', id: entry.manifest.id }); });
  }
  window.flowExtensions = Object.freeze({ register: registerExtension });
}
