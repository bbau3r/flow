// Reading an extension's manifest: the JSON that says what an extension is and what it adds.
// Whatever arrives, from Flow itself or from a file someone picked, comes through here, and only
// what's checked comes out, so the rest of the app can trust its shape. Themes' colors in
// particular end up in a stylesheet, so each one has to be a color and nothing more.

// The colors a palette can set. Any left out come from Sage.
export const PALETTE_COLORS = [
  'desk', 'paper', 'ink', 'muted', 'accent', 'accent-ink', 'secondary', 'secondary-ink',
  'success', 'warning', 'danger', 'rule', 'ribbon-bg', 'ribbon-ink', 'bubble-bg', 'bubble-ink', 'shadow',
];

export const SETTING_TYPES = ['boolean', 'choice', 'text', 'number'];

const ID = /^[a-z][a-z0-9-]{1,39}$/;
const PALETTE_ID = /^[a-z][a-z0-9]{1,23}$/;
const KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const SHORTCUT = /^((Mod|Ctrl|Alt|Shift|Meta)\+)*[A-Za-z0-9]$/;
// An app's code file, named in its manifest as `main`.
const MAIN = /^[\w.-]{1,96}\.m?js$/;

// An icon's path data: SVG path commands and numbers, and nothing else.
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]+$/;

// An icon is one of Flow's own by name, or the extension's own as { paths }, SVG path data on a
// 24 by 24 grid, drawn in Flow's line style. Without one, an extension shows the generic jigsaw.
function readIcon(value, what) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return text(value, what, { max: 30 });
  if (typeof value !== 'object' || !Array.isArray(value.paths) || !value.paths.length || value.paths.length > 12) {
    fail(`Its ${what} has to be a name, or { "paths": [...] } with one to twelve paths.`);
  }
  for (const d of value.paths) {
    if (typeof d !== 'string' || d.length > 1000 || !PATH_DATA.test(d)) fail(`Its ${what} has a path that isn’t SVG path data.`);
  }
  return { paths: [...value.paths] };
}

/** Where a widget can go: after the pills along the bottom, before undo and redo, or top right. */
export const WIDGET_PLACES = ['bottom-start', 'bottom-end', 'top-end'];

class ManifestError extends Error {
  name = 'ManifestError';
}

const fail = (message) => { throw new ManifestError(message); };

const text = (value, what, { max = 200, required = false } = {}) => {
  if (value == null || value === '') {
    if (required) fail(`It needs ${what}.`);
    return '';
  }
  if (typeof value !== 'string') fail(`Its ${what} has to be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(`Its ${what} is longer than ${max} characters.`);
  return trimmed;
};

const isColor = (value) => typeof value === 'string' && !/[;{}<>\\]/.test(value)
  && (typeof CSS === 'undefined' || CSS.supports('color', value));

function readPalette(name, palette) {
  if (!PALETTE_ID.test(name)) fail(`"${name}" can’t name a palette: use lowercase letters and digits, starting with a letter.`);
  if (!palette || typeof palette !== 'object') fail(`Palette "${name}" has to be an object.`);
  const shade = (colors, which) => {
    if (colors == null) return {};
    if (typeof colors !== 'object') fail(`Palette "${name}" has a ${which} that isn’t an object.`);
    const out = {};
    for (const [key, value] of Object.entries(colors)) {
      if (!PALETTE_COLORS.includes(key)) fail(`Palette "${name}" sets "${key}", which isn’t one of the palette’s colors.`);
      if (!isColor(value)) fail(`Palette "${name}" gives ${key} "${value}", which isn’t a color.`);
      out[key] = value;
    }
    return out;
  };
  const light = shade(palette.light, 'light');
  const dark = shade(palette.dark, 'dark');
  if (!Object.keys(light).length && !Object.keys(dark).length) fail(`Palette "${name}" sets no colors.`);
  return { label: text(palette.label, 'palette label', { max: 30 }) || name, light, dark };
}

function readSetting(setting) {
  if (!setting || typeof setting !== 'object') fail('Each setting has to be an object.');
  const key = setting.key;
  if (typeof key !== 'string' || !KEY.test(key)) fail(`"${key}" can’t be a setting’s key.`);
  const type = setting.type ?? 'boolean';
  if (!SETTING_TYPES.includes(type)) fail(`Setting "${key}" has a type Flow doesn’t know: ${type}.`);
  const out = {
    key,
    type,
    label: text(setting.label, `label for setting "${key}"`, { max: 60, required: true }),
    description: text(setting.description, `description for setting "${key}"`, { max: 400 }),
    topic: text(setting.topic, `topic for setting "${key}"`, { max: 40 }) || 'General',
  };
  if (type === 'choice') {
    if (!Array.isArray(setting.options) || !setting.options.length) fail(`Setting "${key}" needs options to choose from.`);
    out.options = setting.options.map((option) => ({
      value: text(String(option?.value ?? ''), `option for "${key}"`, { max: 40, required: true }),
      label: text(option?.label ?? String(option?.value ?? ''), `option label for "${key}"`, { max: 40, required: true }),
    }));
  }
  if (type === 'number') {
    out.min = Number.isFinite(setting.min) ? setting.min : null;
    out.max = Number.isFinite(setting.max) ? setting.max : null;
  }
  out.default = settingValue(out, setting.default);
  return out;
}

/** A value for a setting, as its type wants it, or the setting's default when it won't do. */
export function settingValue(setting, value) {
  const fallback = () => {
    if ('default' in setting) return setting.default;
    return { boolean: false, choice: setting.options?.[0]?.value, text: '', number: setting.min ?? 0 }[setting.type];
  };
  if (setting.type === 'boolean') return typeof value === 'boolean' ? value : fallback();
  if (setting.type === 'choice') return setting.options.some((option) => option.value === value) ? value : fallback();
  if (setting.type === 'text') return typeof value === 'string' ? value.slice(0, 500) : fallback();
  const number = Number(value);
  if (value === '' || value == null || !Number.isFinite(number)) return fallback();
  return Math.min(setting.max ?? Infinity, Math.max(setting.min ?? -Infinity, number));
}

function readCommand(command) {
  if (!command || typeof command !== 'object') fail('Each command has to be an object.');
  const id = command.id;
  if (typeof id !== 'string' || !ID.test(id)) fail(`"${id}" can’t be a command’s id.`);
  const shortcut = text(command.shortcut, `shortcut for command "${id}"`, { max: 30 });
  if (shortcut && !SHORTCUT.test(shortcut)) fail(`Command "${id}" has a shortcut Flow can’t read: ${shortcut}. Write it like Mod+Shift+K.`);
  if (typeof command.insert !== 'string' || !command.insert) fail(`Command "${id}" needs the text it inserts.`);
  if (command.widget != null && !WIDGET_PLACES.includes(command.widget)) fail(`Command "${id}" can only be a widget at ${WIDGET_PLACES.join(', ')}.`);
  return {
    id,
    label: text(command.label, `label for command "${id}"`, { max: 60, required: true }),
    title: text(command.title, `title for command "${id}"`, { max: 200 }),
    icon: readIcon(command.icon, `icon for command "${id}"`),
    shortcut,
    widget: command.widget ?? null,
    insert: command.insert.slice(0, 5000),
  };
}

/**
 * Checks a manifest and returns a clean copy of it, or throws an error saying what's wrong in
 * words a writer can act on. `json` is the text of the file, or the object itself.
 */
export function readManifest(json) {
  let data = json;
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json);
    } catch {
      fail('That isn’t JSON Flow can read.');
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('An extension is a JSON object.');
  if (typeof data.id !== 'string' || !ID.test(data.id)) fail('Its id has to be 2 to 40 lowercase letters, digits or dashes, starting with a letter.');
  if (data.kind !== 'theme' && data.kind !== 'app') fail('Its kind has to be "theme" or "app".');
  const manifest = {
    id: data.id,
    kind: data.kind,
    name: text(data.name, 'name', { max: 60, required: true }),
    version: text(data.version, 'version', { max: 20 }) || '1.0.0',
    author: text(data.author, 'author', { max: 60 }),
    description: text(data.description, 'description', { max: 400 }),
    icon: readIcon(data.icon, 'icon') ?? 'extensions',
  };
  if (manifest.kind === 'theme') {
    if (!data.palettes || typeof data.palettes !== 'object' || !Object.keys(data.palettes).length) fail('A theme needs at least one palette.');
    manifest.palettes = Object.fromEntries(Object.entries(data.palettes).map(([name, palette]) => [name, readPalette(name, palette)]));
    return manifest;
  }
  if (data.settings != null && !Array.isArray(data.settings)) fail('Its settings have to be a list.');
  manifest.settings = (data.settings ?? []).map(readSetting);
  const keys = manifest.settings.map(({ key }) => key);
  if (new Set(keys).size !== keys.length) fail('Two of its settings have the same key.');
  if (data.commands != null && !Array.isArray(data.commands)) fail('Its commands have to be a list.');
  manifest.commands = (data.commands ?? []).map(readCommand);
  // Code an app brings with it, in a file of its own beside the manifest.
  if (data.main != null) {
    if (typeof data.main !== 'string' || !MAIN.test(data.main)) fail('Its main has to be the name of a .js file, such as index.js.');
    manifest.main = data.main;
  }
  return manifest;
}
