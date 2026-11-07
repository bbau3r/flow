// A script's own settings, kept in a boneyard at the bottom of its title page, with one
// name: value pair per line. Being a boneyard, they never print, here or in any other
// Fountain app, and the editor shows them only in Fountain view.
//
//   /*
//   Settings:
//       Dimensions: A4
//   */
//
// Dimensions is US Letter, A4, or a width and height in inches, centimetres or millimetres,
// such as 6in x 9in, 6" x 9", 15cm x 23cm or 150 x 230 mm.

/** Named paper sizes. Metrics follow afterwriting's print profiles. */
export const PROFILES = {
  letter: { paper: 'letter', widthIn: 8.5, heightIn: 11, linesPerPage: 55, actionWidth: 61 },
  a4: { paper: 'a4', widthIn: 8.27, heightIn: 11.7, linesPerPage: 57, actionWidth: 58 },
};

export const PAPER_NAMES = { letter: 'US Letter', a4: 'A4' };

/** The units a custom size can be in, as how many of each make an inch. */
export const UNITS = { in: 1, cm: 2.54, mm: 25.4 };

// The script's columns are set in inches from the left edge, so a page narrower than this
// would cut dialogue and character cues off its right side.
export const CUSTOM_LIMITS = { width: [7.5, 17], height: [6, 17] };

/** CUSTOM_LIMITS in another unit, rounded inwards so both ends are allowed. */
export function customLimits(unit = 'in') {
  const per = UNITS[unit] ?? 1;
  const range = ([min, max]) => [Math.ceil(min * per * 100) / 100, Math.floor(max * per * 100) / 100];
  return { width: range(CUSTOM_LIMITS.width), height: range(CUSTOM_LIMITS.height) };
}

const clamp = (n, [min, max]) => Math.min(max, Math.max(min, n));
const round = (n) => Math.round(n * 100) / 100;

const UNIT = String.raw`(in|inch|inches|"|”|″|cm|mm)?`;
const UNIT_OF = { inch: 'in', inches: 'in', '"': 'in', '”': 'in', '″': 'in' };
const NUMBER = String.raw`(\d+(?:\.\d*)?|\.\d+)`;
const SIZE_RE = new RegExp(String.raw`^${NUMBER}\s*${UNIT}\s*[x×*]\s*${NUMBER}\s*${UNIT}$`);

/**
 * Reads a page size: 'letter' or 'a4' for a named size, or { width, height, unit } for a
 * custom one, kept within CUSTOM_LIMITS. A unit given once, as in 150 x 230 mm, counts for
 * both sides, and inches are the default. Null for anything it doesn't recognize.
 */
export function parseDimensions(text) {
  if (text && typeof text === 'object') return customSize(text.width, text.height, text.unit);
  const value = String(text ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (/^(?:us )?letter$/.test(value)) return 'letter';
  if (value === 'a4') return 'a4';
  const size = SIZE_RE.exec(value);
  if (!size) return null;
  const unitOf = (u) => (u ? UNIT_OF[u] ?? u : null);
  const unit = unitOf(size[2]) ?? unitOf(size[4]) ?? 'in';
  const heightUnit = unitOf(size[4]) ?? unit;
  return customSize(Number(size[1]), (Number(size[3]) * UNITS[unit]) / UNITS[heightUnit], unit);
}

function customSize(width, height, unit = 'in') {
  const per = UNITS[unit];
  if (!per || !(width > 0) || !(height > 0)) return null;
  const fit = (n, limits) => round(clamp(n / per, limits) * per);
  return { width: fit(width, CUSTOM_LIMITS.width), height: fit(height, CUSTOM_LIMITS.height), unit };
}

/** A page size as the Settings block writes it, and as the dialogs name it. */
export function formatDimensions(paper) {
  const size = parseDimensions(paper);
  if (!size) return PAPER_NAMES.letter;
  return typeof size === 'string' ? PAPER_NAMES[size] : `${size.width}${size.unit} x ${size.height}${size.unit}`;
}

/** The layout metrics for a page size, with US Letter for one it doesn't recognize. */
export function pageProfile(paper) {
  const size = parseDimensions(paper) ?? 'letter';
  if (typeof size === 'string') return PROFILES[size];
  // Margins as on US Letter: 1.5in on the left, about 1in on the right, and 11 rows for the
  // top and bottom margins and the page number.
  const widthIn = size.width / UNITS[size.unit];
  const heightIn = size.height / UNITS[size.unit];
  return {
    paper: 'custom',
    widthIn,
    heightIn,
    // Rounded first, so that a metric size a hair under a whole column still gets it.
    linesPerPage: Math.floor(round(heightIn * 6)) - 11,
    actionWidth: Math.floor(round(widthIn * 10)) - 24,
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
const OPENING_RE = /^\s*settings[ \t]*:[ \t]*/i;

/**
 * The script's Settings block: the first boneyard that opens with "Settings:", as
 * { comment, values, whole }. `values` maps each lower-case name to { label, value }, and
 * `whole` says whether the boneyard has its lines to itself. Used by the parser.
 */
export function findSettings(comments, source) {
  const comment = comments.find((c) => c.type === 'boneyard' && OPENING_RE.test(source.slice(c.start + 2, c.end - 2)));
  if (!comment) return null;
  const values = {};
  const body = source.slice(comment.start + 2, comment.end - 2).replace(OPENING_RE, '');
  for (const line of body.split('\n')) {
    const pair = SETTING_RE.exec(line);
    if (pair) values[pair[1].toLowerCase()] = { label: pair[1], value: pair[2] };
  }
  const lineStartAt = source.lastIndexOf('\n', comment.start - 1) + 1;
  const lineEndAt = source.indexOf('\n', comment.end);
  const whole = !source.slice(lineStartAt, comment.start).trim() && !source.slice(comment.end, lineEndAt < 0 ? source.length : lineEndAt).trim();
  return { comment, values, whole };
}

/** The Settings block's values, keyed by lower-case name. */
export function readSettings(block) {
  return Object.fromEntries(Object.entries(block?.values ?? {}).map(([key, { value }]) => [key, value]));
}

// Kept in a boneyard so that other Fountain apps leave it out, as Flow's own pages do.
function settingsBlock(entries, indent = '    ') {
  return ['/*', 'Settings:', ...entries.map(([label, value]) => `${indent}${label}: ${value}`), '*/'];
}

/**
 * Sets one setting, such as ('Dimensions', 'A4'), and returns the script's new lines. A
 * script without a Settings block gets one at the bottom of its title page, or at the top
 * when it has none.
 */
export function writeSetting(parsed, name, value) {
  const lines = parsed.lines.map((l) => l.raw);
  const block = parsed.settingsBlock;
  if (!block) {
    const at = parsed.titlePage.length ? Math.max(...parsed.titlePage.flatMap((e) => e.lines)) + 1 : 0;
    const added = settingsBlock([[name, value]]);
    // A blank line keeps it apart from the script that follows.
    if (!parsed.titlePage.length && (lines[0] ?? '').trim() !== '') added.push('');
    lines.splice(at, 0, ...added);
    return lines;
  }
  const { source } = parsed;
  const { comment, values } = block;
  const entries = Object.values(values).map(({ label, value: v }) => [label, v]);
  const existing = Object.keys(values).indexOf(name.toLowerCase());
  if (existing >= 0) entries[existing][1] = value;
  else entries.push([name, value]);
  const indent = /\n([ \t]+)\S/.exec(source.slice(comment.start, comment.end))?.[1];
  const text = source.slice(0, comment.start) + settingsBlock(entries, indent).join('\n') + source.slice(comment.end);
  return text.split('\n');
}
