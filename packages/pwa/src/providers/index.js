// Places scripts can be opened from and saved to. Each provider is an object with:
//
//   id, label, description
//   status()            { ok } or { ok: false, reason } if it can't be used right now
//   open()              { name, text, ref }, or null if the user cancelled
//   save(doc, options)  { name, ref } after writing to the doc's file, or null if the user
//                       cancelled. Throws ConflictError if the file changed, unless
//                       options.force is set. err.target goes back in options on retry.
//   saveAs(doc)         { name, ref } for a new file, or null if the user cancelled
//   saveHint()          what choosing this provider in the save dialog will do
//   location(doc)       where a doc saved here lives, in words
//
// Adding a storage option means writing one of these and listing it here, or an extension
// adding one with addSource.

import { localProvider } from './local.js';

export const providers = [localProvider];

const PROVIDER_KEYS = ['id', 'label', 'description', 'status', 'open', 'save', 'saveAs', 'saveHint', 'location'];

/** Adds a provider while the app runs, such as from an extension. Returns a function that takes it away. */
export function addProvider(provider) {
  const missing = PROVIDER_KEYS.filter((key) => provider?.[key] == null);
  if (missing.length) throw new Error(`A source needs ${missing.join(', ')}.`);
  if (providers.some((p) => p.id === provider.id)) throw new Error(`There’s a source called "${provider.id}" already.`);
  providers.push(provider);
  return () => {
    const at = providers.indexOf(provider);
    if (at >= 0) providers.splice(at, 1);
  };
}

export const getProvider = (id) => providers.find((p) => p.id === id);

export class ConflictError extends Error {
  name = 'ConflictError';
}

export function fileNameFor(rawName) {
  // The separators between a title's lines read better as dashes in a file name.
  const name = rawName.replace(/\s*\u00b7\s*/g, ' - ');
  const clean = (name || 'Untitled Screenplay').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled Screenplay';
  return /\.(fountain|spmd|txt)$/i.test(clean) ? clean : `${clean}.fountain`;
}
