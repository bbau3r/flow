// The starting point for a new script: a title page and, when asked for, a page size. By
// default the title page has every field that prints, filled with placeholders so writers can
// see what's available and delete what they don't need. An app can pass its own fields instead,
// such as a writer's saved name and contact details.

import { parse } from './parser.js';
import { formatDimensions, writeSetting } from './settings.js';

/**
 * The title page fields after Title, as { key, value }. A value on several lines is written
 * indented under its key, and `{date}` and `{year}` become the day the script is made.
 */
export const DEFAULT_COVER = [
  { key: 'Credit', value: 'Written by' },
  { key: 'Author', value: 'Your Name' },
  { key: 'Source', value: 'Based On Blank' },
  { key: 'Draft date', value: '{date}' },
  { key: 'Contact', value: 'Your Name\nyou@example.com\n555-555-5555' },
  { key: 'Copyright', value: '(c) {year} Your Name' },
  { key: 'Notes', value: 'First draft' },
];

/**
 * `cover` replaces the fields after Title, and a field with no value is left out. `dimensions`,
 * when given, writes a page size into the script's settings; null or 'letter' writes none.
 */
export function newScript(today = new Date(), { cover = DEFAULT_COVER, dimensions = null } = {}) {
  const date = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const fill = (text) => text.replaceAll('{date}', date).replaceAll('{year}', String(today.getFullYear()));
  const lines = ['Title: Untitled'];
  for (const { key, value } of cover) {
    const name = String(key ?? '').replace(/:/g, '').trim();
    const values = fill(String(value ?? '')).split('\n').map((line) => line.trim()).filter(Boolean);
    if (!name || !values.length) continue;
    if (values.length === 1) lines.push(`${name}: ${values[0]}`);
    else lines.push(`${name}:`, ...values.map((line) => `    ${line}`));
  }
  lines.push('', '');
  const text = lines.join('\n');
  if (!dimensions || dimensions === 'letter') return text;
  return writeSetting(parse(text), 'Dimensions', formatDimensions(dimensions)).join('\n');
}
