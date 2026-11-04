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
// Adding a storage option means writing one of these and listing it here.

import { localProvider } from './local.js';

export const providers = [localProvider];

export const getProvider = (id) => providers.find((p) => p.id === id);

export class ConflictError extends Error {
  name = 'ConflictError';
}

export function fileNameFor(name) {
  const clean = (name || 'Untitled Screenplay').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled Screenplay';
  return /\.(fountain|spmd|txt)$/i.test(clean) ? clean : `${clean}.fountain`;
}
