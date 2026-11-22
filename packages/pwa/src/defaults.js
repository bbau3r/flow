// What a new script starts with on this device: its page size and the fields of its title page
// after Title, such as the writer's name and contact details, each of which can be left off.
// Kept in local storage and edited on the Defaults page of App settings.

import { DEFAULT_COVER, newScript } from '@flow/core';

const DEFAULTS_KEY = 'flow-defaults';

/**
 * { dimensions, cover }, where `dimensions` is 'letter', 'a4' or { width, height, unit }, and
 * `cover` is every standard title page field, in order, as { key, value, enabled }.
 */
export function readDefaults() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(DEFAULTS_KEY));
  } catch {
    // Unreadable or refused storage just means the built-in defaults.
  }
  const savedFields = Array.isArray(saved?.cover) ? saved.cover : [];
  const cover = DEFAULT_COVER.map(({ key, value }) => {
    const mine = savedFields.find((field) => field?.key === key);
    return { key, value: mine ? String(mine.value ?? '') : value, enabled: mine ? mine.enabled !== false : true };
  });
  return { dimensions: saved?.dimensions ?? 'letter', cover };
}

export function saveDefaults(defaults) {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Private browsing can refuse storage; the defaults then last only for this visit.
  }
}

/** A new script's text, from the defaults. */
export function scriptFromDefaults() {
  const { dimensions, cover } = readDefaults();
  return newScript(new Date(), { dimensions, cover: cover.filter((field) => field.enabled) });
}
