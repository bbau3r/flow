// A theme is a set of colors applied as --flow-* custom properties. Presets ship
// in the stylesheet; pages can restyle by setting the properties in their own CSS
// or by registering a named theme here.
//
// Each palette comes as <name>-light, <name>-dark and <name>-auto, which follows the
// system setting. Plain "auto" is amber-auto.

export const PALETTES = {
  amber: {
    label: 'Amber',
    light: {
      desk: '#efe4cb',
      paper: '#fffaf0',
      ink: '#2a1f0e',
      muted: '#6f521c',
      accent: '#b45309',
      'accent-ink': '#fffaf0',
      rule: '#dfcda4',
      'ribbon-bg': '#fdf3dc',
      'ribbon-ink': '#3d2c10',
      'bubble-bg': '#fde9b4',
      'bubble-ink': '#4a3208',
      shadow: 'rgb(90 60 10 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1e1d1a',
      paper: '#292724',
      ink: '#ffcc7a',
      muted: '#c0964a',
      accent: '#ffb000',
      'accent-ink': '#292724',
      rule: '#4a473f',
      'ribbon-bg': '#23221f',
      'ribbon-ink': '#ffcc7a',
      'bubble-bg': '#474033',
      'bubble-ink': '#ffdb9e',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Coastal: dusk blue on light cyan, with burnt peach for comments.
  ocean: {
    label: 'Ocean',
    light: {
      desk: '#cfe3ee',
      paper: '#f5fdfd',
      ink: '#293241',
      muted: '#3d5a80',
      accent: '#3d5a80',
      'accent-ink': '#f5fdfd',
      rule: '#a9cbe0',
      'ribbon-bg': '#e0fbfc',
      'ribbon-ink': '#293241',
      'bubble-bg': '#fbd3c8',
      'bubble-ink': '#7a2a17',
      shadow: 'rgb(41 50 65 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1f2631',
      paper: '#293241',
      ink: '#e0fbfc',
      muted: '#98c1d9',
      accent: '#98c1d9',
      'accent-ink': '#293241',
      rule: '#3d5a80',
      'ribbon-bg': '#232b38',
      'ribbon-ink': '#e0fbfc',
      'bubble-bg': '#4f3330',
      'bubble-ink': '#fbd3c8',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Burgundy and flag red on warm paper, with sunflower gold for comments.
  autumn: {
    label: 'Autumn',
    light: {
      desk: '#f3e2cc',
      paper: '#fffaf2',
      ink: '#3a0a10',
      muted: '#780116',
      accent: '#c32f27',
      'accent-ink': '#fffaf2',
      rule: '#e8c9a2',
      'ribbon-bg': '#fdf0dc',
      'ribbon-ink': '#3a0a10',
      'bubble-bg': '#fde3a8',
      'bubble-ink': '#6b3a07',
      shadow: 'rgb(120 1 22 / 0.22)',
      scheme: 'light',
    },
    dark: {
      desk: '#1f1414',
      paper: '#2a1b1b',
      ink: '#f7d9a8',
      muted: '#db9a5c',
      accent: '#f7b538',
      'accent-ink': '#2a1b1b',
      rule: '#4d3030',
      'ribbon-bg': '#241717',
      'ribbon-ink': '#f7d9a8',
      'bubble-bg': '#4a2a20',
      'bubble-ink': '#fbd5b0',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  forest: {
    label: 'Forest',
    light: {
      desk: '#e4dac3',
      paper: '#fbf8ef',
      ink: '#23291a',
      muted: '#6b5433',
      accent: '#3f6b2f',
      'accent-ink': '#fbf8ef',
      rule: '#d2c5a4',
      'ribbon-bg': '#f3eddc',
      'ribbon-ink': '#2f3522',
      'bubble-bg': '#dfe6c4',
      'bubble-ink': '#34401f',
      shadow: 'rgb(60 50 20 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1e1e1a',
      paper: '#292824',
      ink: '#e2dcbe',
      muted: '#b8a27c',
      accent: '#8fc05c',
      'accent-ink': '#292824',
      rule: '#4a493f',
      'ribbon-bg': '#23231f',
      'ribbon-ink': '#e2dcbe',
      'bubble-bg': '#474533',
      'bubble-ink': '#e6e3c2',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Space indigo and dusty grape on parchment, with lilac and almond between.
  lavender: {
    label: 'Lavender',
    light: {
      desk: '#e5d7d2',
      paper: '#f8f3f0',
      ink: '#22223b',
      muted: '#5e5568',
      accent: '#4a4e69',
      'accent-ink': '#f8f3f0',
      rule: '#c9ada7',
      'ribbon-bg': '#f2e9e4',
      'ribbon-ink': '#22223b',
      'bubble-bg': '#e3d9e1',
      'bubble-ink': '#3a3550',
      shadow: 'rgb(34 34 59 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1b1b2e',
      paper: '#22223b',
      ink: '#f2e9e4',
      muted: '#b3a5b0',
      accent: '#c9ada7',
      'accent-ink': '#22223b',
      rule: '#4a4e69',
      'ribbon-bg': '#1f1f34',
      'ribbon-ink': '#f2e9e4',
      'bubble-bg': '#3a3a55',
      'bubble-ink': '#f2e9e4',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
};

const toCss = (theme) =>
  Object.entries(theme)
    .map(([k, v]) => (k === 'scheme' ? `color-scheme:${v};` : `--flow-${k}:${v};`))
    .join('');

// Every preset, with `base` as the unthemed default and `select(name)` picking a theme.
function themeRules(base, select) {
  const rule = (name, colors) => `${select(name)} { ${toCss(colors)} }`;
  const auto = (name, { light, dark }) => [
    rule(name, light),
    `@media (prefers-color-scheme: dark) { ${rule(name, dark)} }`,
  ];
  return [
    `${base} { ${toCss(PALETTES.amber.light)} }`,
    ...Object.entries(PALETTES).flatMap(([name, palette]) => [
      rule(`${name}-light`, palette.light),
      rule(`${name}-dark`, palette.dark),
      ...auto(`${name}-auto`, palette),
    ]),
    ...auto('auto', PALETTES.amber),
  ].join('\n');
}

export const THEME_CSS = themeRules(':host', (name) => `:host([theme="${name}"])`);

/** The same presets for a whole page, selected by <html data-theme="...">. */
export const PAGE_THEME_CSS = themeRules(':root', (name) => `:root[data-theme="${name}"]`);

const registry = new Map();

// registerTheme('sepia', { paper: '#f4ecd8', ink: '#3b2f1e' }) then <flow-script theme="sepia">.
// Any color left out falls back to amber light.
export function registerTheme(name, colors) {
  registry.set(name, colors);
  document.querySelectorAll(`flow-script[theme="${CSS.escape(name)}"]`).forEach((el) => el.applyTheme());
}

export const getTheme = (name) => registry.get(name);
