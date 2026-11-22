// Places scripts can be opened from and saved to, which Flow calls sources. Each provider is an
// object with:
//
//   id, label, description
//   kind                'local' for files on this device, or 'cloud' for a cloud service
//   icon                optional: a name or { paths }, for a cloud provider's sheet on the home
//                       page; an extension's own icon otherwise
//   status()            { ok } or { ok: false, reason } if it can't be used right now
//   open()              { name, text, ref }, or null if the user cancelled
//   save(doc, options)  { name, ref } after writing to the doc's file, or null if the user
//                       cancelled. Throws ConflictError if the file changed, unless
//                       options.force is set. err.target goes back in options on retry.
//   saveAs(doc)         { name, ref } for a new file, or null if the user cancelled
//   saveHint()          what choosing this provider in the save dialog will do
//   location(doc)       where a doc saved here lives, in words
//
// A cloud provider that needs signing in, or setting up, can also have:
//
//   connection()        { connected, account }, where `account` names who or where, in words
//   connect()           signs in or sets up, resolving to connection(), or null if cancelled
//   disconnect()        signs out or forgets the setup
//
// Flow connects before opening or saving with it, and the settings page of the extension that
// adds it offers both. Each cloud provider has a sheet of its own on the home page, beside Open.
//
// A script that isn't in any file yet lives only in this browser's storage: its source is Temp.
//
// Adding a storage option means writing one of these and listing it here, or an extension
// adding one with addSource.

import { localProvider } from './local.js';

export const providers = [localProvider];

const PROVIDER_KEYS = ['id', 'label', 'description', 'status', 'open', 'save', 'saveAs', 'saveHint', 'location'];

export const SOURCE_KINDS = { temp: 'Temp', local: 'Local', cloud: 'Cloud' };

/** Adds a provider while the app runs, such as from an extension. Returns a function that takes it away. */
export function addProvider(provider) {
  const missing = PROVIDER_KEYS.filter((key) => provider?.[key] == null);
  if (missing.length) throw new Error(`A source needs ${missing.join(', ')}.`);
  if (provider.kind !== 'local' && provider.kind !== 'cloud') throw new Error('A source’s kind has to be "local" or "cloud".');
  if (providers.some((p) => p.id === provider.id)) throw new Error(`There’s a source called "${provider.id}" already.`);
  providers.push(provider);
  return () => {
    const at = providers.indexOf(provider);
    if (at >= 0) providers.splice(at, 1);
  };
}

export const getProvider = (id) => providers.find((p) => p.id === id);

/**
 * Where a doc lives, as { kind, label, provider }: 'temp' for one only in this browser,
 * 'local' for a file on this device, or 'cloud', with the service's name. A doc keeps what it
 * last knew of its provider, for when the extension that added it is turned off.
 */
export function sourceOf(doc) {
  if (!doc.provider) return { kind: 'temp', label: SOURCE_KINDS.temp, provider: '' };
  const provider = getProvider(doc.provider);
  const kind = provider?.kind ?? doc.source?.kind ?? (doc.provider === 'local' ? 'local' : 'cloud');
  const name = provider?.label ?? doc.source?.label ?? doc.provider;
  return { kind, label: kind === 'cloud' ? `${SOURCE_KINDS.cloud} · ${name}` : SOURCE_KINDS[kind], provider: name };
}

/** What a doc remembers of its provider: its kind and name. */
export const sourceRecord = (provider) => ({ kind: provider.kind, label: provider.label });

/**
 * Makes sure a provider is ready to use, connecting it first when it needs to be. Resolves to
 * false when the person cancelled connecting.
 */
export async function ensureConnected(provider) {
  if (!provider.connection || provider.connection()?.connected) return true;
  return !!(await provider.connect());
}

export class ConflictError extends Error {
  name = 'ConflictError';
}

export function fileNameFor(rawName) {
  // The separators between a title's lines read better as dashes in a file name.
  const name = rawName.replace(/\s*·\s*/g, ' - ');
  const clean = (name || 'Untitled Screenplay').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled Screenplay';
  return /\.(fountain|spmd|txt)$/i.test(clean) ? clean : `${clean}.fountain`;
}
