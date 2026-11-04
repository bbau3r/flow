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
  ocean: {
    label: 'Ocean',
    light: {
      desk: '#d5e8f0',
      paper: '#f7fcfe',
      ink: '#10303f',
      muted: '#3a6073',
      accent: '#0d6f94',
      'accent-ink': '#f7fcfe',
      rule: '#b4d4e0',
      'ribbon-bg': '#e6f4f9',
      'ribbon-ink': '#10303f',
      'bubble-bg': '#cdeaf5',
      'bubble-ink': '#0c3546',
      shadow: 'rgb(10 50 70 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1a1d1e',
      paper: '#242729',
      ink: '#bfe6f5',
      muted: '#7fb0c4',
      accent: '#38bdf8',
      'accent-ink': '#242729',
      rule: '#3f474a',
      'ribbon-bg': '#1f2223',
      'ribbon-ink': '#bfe6f5',
      'bubble-bg': '#334047',
      'bubble-ink': '#cdeffb',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  volcano: {
    label: 'Volcano',
    light: {
      desk: '#eddcd5',
      paper: '#fff9f6',
      ink: '#2b1512',
      muted: '#7d3f32',
      accent: '#bb2a12',
      'accent-ink': '#fff9f6',
      rule: '#dfc0b5',
      'ribbon-bg': '#fbeee8',
      'ribbon-ink': '#3e1c16',
      'bubble-bg': '#fbd9cc',
      'bubble-ink': '#571f12',
      shadow: 'rgb(90 30 10 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1e1b1a',
      paper: '#292524',
      ink: '#ffc7b0',
      muted: '#d08a70',
      accent: '#ff5a2c',
      'accent-ink': '#292524',
      rule: '#4a423f',
      'ribbon-bg': '#23201f',
      'ribbon-ink': '#ffc7b0',
      'bubble-bg': '#473833',
      'bubble-ink': '#ffd6c5',
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
  tulip: {
    label: 'Tulip',
    light: {
      desk: '#e8ddf1',
      paper: '#fdfaff',
      ink: '#2a1638',
      muted: '#634780',
      accent: '#7b37a6',
      'accent-ink': '#fdfaff',
      rule: '#d6c4e5',
      'ribbon-bg': '#f4ecfa',
      'ribbon-ink': '#3a2050',
      'bubble-bg': '#ecd9f7',
      'bubble-ink': '#43205e',
      shadow: 'rgb(60 20 90 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1c1a1e',
      paper: '#272429',
      ink: '#e3cdf5',
      muted: '#ab8cc7',
      accent: '#c084f5',
      'accent-ink': '#272429',
      rule: '#463f4a',
      'ribbon-bg': '#221f23',
      'ribbon-ink': '#e3cdf5',
      'bubble-bg': '#3f3347',
      'bubble-ink': '#edddfa',
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
