// A script's own settings, kept on its title page as a Settings: key with one name: value
// pair per indented line. They never print, and the editor shows them only in Fountain view.
//
//   Settings:
//       Dimensions: A4
//
// Dimensions is US Letter, A4, or a width and height in inches, such as 6in x 9in or 6" x 9".

/** Named paper sizes. Metrics follow afterwriting's print profiles. */
export const PROFILES = {
  letter: { paper: 'letter', widthIn: 8.5, heightIn: 11, linesPerPage: 55, actionWidth: 61 },
  a4: { paper: 'a4', widthIn: 8.27, heightIn: 11.7, linesPerPage: 57, actionWidth: 58 },
};

export const PAPER_NAMES = { letter: 'US Letter', a4: 'A4' };

// The script's columns are set in inches from the left edge, so a page narrower than this
// would cut dialogue and character cues off its right side.
export const CUSTOM_LIMITS = { width: [7.5, 17], height: [6, 17] };

const clamp = (n, [min, max]) => Math.min(max, Math.max(min, n));
const round = (n) => Math.round(n * 100) / 100;

const INCHES = String.raw`(?:in|inch|inches|"|”|″)?`;
const NUMBER = String.raw`(\d+(?:\.\d*)?|\.\d+)`;
const SIZE_RE = new RegExp(String.raw`^${NUMBER}\s*${INCHES}\s*[x×*]\s*${NUMBER}\s*${INCHES}$`);

/**
 * Reads a page size: 'letter' or 'a4' for a named size, or { width, height } in inches,
 * kept within CUSTOM_LIMITS. Null for anything it doesn't recognize.
 */
export function parseDimensions(text) {
  if (text && typeof text === 'object') return customSize(text.width, text.height);
  const value = String(text ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (/^(?:us )?letter$/.test(value)) return 'letter';
  if (value === 'a4') return 'a4';
  const size = SIZE_RE.exec(value);
  return size ? customSize(Number(size[1]), Number(size[2])) : null;
}

function customSize(width, height) {
  if (!(width > 0) || !(height > 0)) return null;
  return { width: round(clamp(width, CUSTOM_LIMITS.width)), height: round(clamp(height, CUSTOM_LIMITS.height)) };
}

/** A page size as the Settings block writes it, and as the dialogs name it. */
export function formatDimensions(paper) {
  const size = parseDimensions(paper);
  if (!size) return PAPER_NAMES.letter;
  return typeof size === 'string' ? PAPER_NAMES[size] : `${size.width}in x ${size.height}in`;
}

/** The layout metrics for a page size, with US Letter for one it doesn't recognize. */
export function pageProfile(paper) {
  const size = parseDimensions(paper) ?? 'letter';
  if (typeof size === 'string') return PROFILES[size];
  // Margins as on US Letter: 1.5in on the left, about 1in on the right, and 11 rows for the
  // top and bottom margins and the page number.
  return {
    paper: 'custom',
    widthIn: size.width,
    heightIn: size.height,
    linesPerPage: Math.floor(size.height * 6) - 11,
    actionWidth: Math.floor(size.width * 10) - 24,
  };
}

/**
 * The page size to lay out: `paperOverride` when given, such as for one export, then the
 * script's own Dimensions setting, then `paper`, the default of whatever shows the script.
 */
export function resolvePaper(parsed, { paper, paperOverride } = {}) {
  return parseDimensions(paperOverride) ?? parseDimensions(parsed.settings?.dimensions) ?? parseDimensions(paper) ?? 'letter';
}

const SETTING_RE = /^[ \t]*([^:]+?)[ \t]*:[ \t]*(.*?)[ \t]*$/;

/** The Settings block's values, keyed by lower-case name. Used by the parser. */
export function readSettings(titlePage, lines) {
  const settings = {};
  const entry = titlePage.find((e) => e.key === 'settings');
  if (!entry) return settings;
  entry.lines.forEach((i, n) => {
    const text = n === 0 ? lines[i].visible.slice(lines[i].contentStart) : lines[i].visible;
    const pair = SETTING_RE.exec(text);
    if (pair) settings[pair[1].toLowerCase()] = pair[2];
  });
  return settings;
}

/**
 * Sets one setting, such as ('Dimensions', 'A4'), and returns the script's new lines. A
 * script without a Settings block gets one at the top of its title page, or a title page
 * holding only that when it has none.
 */
export function writeSetting(parsed, name, value) {
  const lines = parsed.lines.map((l) => l.raw);
  const entry = parsed.titlePage.find((e) => e.key === 'settings');
  if (!entry) {
    const at = parsed.titlePage.length ? parsed.titlePage[0].lines[0] : 0;
    const block = ['Settings:', `    ${name}: ${value}`];
    // A title page ends at the first blank line, which keeps it apart from the script.
    if (!parsed.titlePage.length && (lines[0] ?? '').trim() !== '') block.push('');
    lines.splice(at, 0, ...block);
    return lines;
  }
  const wanted = name.toLowerCase();
  const values = entry.lines.slice(1);
  const existing = values.find((i) => SETTING_RE.exec(lines[i])?.[1].toLowerCase() === wanted);
  if (existing !== undefined) {
    const [, indent] = /^([ \t]*)/.exec(lines[existing]);
    lines[existing] = `${indent}${SETTING_RE.exec(lines[existing])[1]}: ${value}`;
    return lines;
  }
  const keyLine = entry.lines[0];
  const inline = SETTING_RE.exec(parsed.lines[keyLine].visible.slice(parsed.lines[keyLine].contentStart));
  if (inline && inline[1].toLowerCase() === wanted) {
    lines[keyLine] = `${lines[keyLine].slice(0, parsed.lines[keyLine].contentStart)}${inline[1]}: ${value}`;
    return lines;
  }
  const indent = values.length ? /^[ \t]*/.exec(lines[values[0]])[0] : '    ';
  // An empty value line, left while typing, takes the setting rather than staying above it.
  const last = entry.lines[entry.lines.length - 1];
  if (values.length && !lines[last].trim()) lines[last] = `${indent}${name}: ${value}`;
  else lines.splice(last + 1, 0, `${indent}${name}: ${value}`);
  return lines;
}
