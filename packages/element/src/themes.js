// A theme is a set of colors applied as --flow-* custom properties. Presets ship
// in the stylesheet; pages can restyle by setting the properties in their own CSS
// or by registering a named theme here.
//
// Each palette comes as <name>-light, <name>-dark and <name>-auto, which follows the
// system setting. Plain "auto" is sage-auto.
//
// Besides the page and its text, each one names a primary color (accent), a secondary that
// complements it, and success, warning and danger, which stay much the same everywhere and
// only shift where the palette's own colors would clash with them. Controls take their
// colors from these through the tokens in controls.js.

export const PALETTES = {
  // Deep teal and charcoal blue on pale ash by day, muted teal on near-grey by night.
  sage: {
    label: 'Sage',
    light: {
      desk: '#dfe4db',
      paper: '#f6f8f4',
      ink: '#2f3e46',
      muted: '#4c6662',
      accent: '#52796f',
      'accent-ink': '#f6f8f4',
      secondary: '#b0645a',
      'secondary-ink': '#f6f8f4',
      success: '#3d7d3a',
      warning: '#a3670a',
      danger: '#b3302d',
      rule: '#cad2c5',
      'ribbon-bg': '#eef1ea',
      'ribbon-ink': '#2f3e46',
      'bubble-bg': '#d5e3d5',
      'bubble-ink': '#354f52',
      shadow: 'rgb(47 62 70 / 0.22)',
      scheme: 'light',
    },
    dark: {
      desk: '#1c1e1d',
      paper: '#262928',
      ink: '#e3e8e0',
      muted: '#a9bcb0',
      accent: '#84a98c',
      'accent-ink': '#262928',
      secondary: '#e0a395',
      'secondary-ink': '#262928',
      success: '#8fcf7e',
      warning: '#e8b04a',
      danger: '#f07a72',
      rule: '#3d4644',
      'ribbon-bg': '#212423',
      'ribbon-ink': '#e3e8e0',
      'bubble-bg': '#354f52',
      'bubble-ink': '#e3e8e0',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Warm paper halfway between amber and linen, with caramel controls and a soft gold in the dark.
  sand: {
    label: 'Sand',
    light: {
      desk: '#e9dcca',
      paper: '#fcf6ee',
      ink: '#32271c',
      muted: '#6e5737',
      accent: '#97592c',
      'accent-ink': '#fcf6ee',
      secondary: '#3f6c8f',
      'secondary-ink': '#fcf6ee',
      success: '#2f7d4a',
      warning: '#b07d00',
      danger: '#b3302d',
      rule: '#dac5a9',
      'ribbon-bg': '#f5f0e2',
      'ribbon-ink': '#3c2e1d',
      'bubble-bg': '#e9dabb',
      'bubble-ink': '#423119',
      shadow: 'rgb(85 60 28 / 0.24)',
      scheme: 'light',
    },
    dark: {
      desk: '#1e1c1a',
      paper: '#2a2724',
      ink: '#f6dcb2',
      muted: '#c2a67a',
      accent: '#eab658',
      'accent-ink': '#2a2724',
      secondary: '#8fb6d6',
      'secondary-ink': '#2a2724',
      success: '#6cc58a',
      warning: '#f0c24a',
      danger: '#f07a72',
      rule: '#4a453e',
      'ribbon-bg': '#24221f',
      'ribbon-ink': '#f6dcb2',
      'bubble-bg': '#463e34',
      'bubble-ink': '#fae3bf',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Teal on white by day, and on sea-tinted grey by night, with pale sky for comments.
  sea: {
    label: 'Sea',
    light: {
      desk: '#e1e5f2',
      paper: '#ffffff',
      ink: '#022b3a',
      muted: '#1f5a6b',
      accent: '#1f7a8c',
      'accent-ink': '#ffffff',
      secondary: '#c4553a',
      'secondary-ink': '#ffffff',
      success: '#2f7d4a',
      warning: '#a3670a',
      danger: '#b3302d',
      rule: '#bfdbf7',
      'ribbon-bg': '#f3f5fa',
      'ribbon-ink': '#022b3a',
      'bubble-bg': '#bfdbf7',
      'bubble-ink': '#022b3a',
      shadow: 'rgb(2 43 58 / 0.2)',
      scheme: 'light',
    },
    dark: {
      desk: '#181c1e',
      paper: '#22282b',
      ink: '#e1e5f2',
      muted: '#9fbcd6',
      accent: '#5fb8c9',
      'accent-ink': '#22282b',
      secondary: '#f08a6c',
      'secondary-ink': '#22282b',
      success: '#6cc58a',
      warning: '#e8b04a',
      danger: '#f07a72',
      rule: '#36444a',
      'ribbon-bg': '#1c2124',
      'ribbon-ink': '#e1e5f2',
      'bubble-bg': '#245a66',
      'bubble-ink': '#ffffff',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Wine plum and smoky rose on bone by day, maroon and rose-mauve on plum-tinted grey by night.
  romance: {
    label: 'Romance',
    light: {
      desk: '#cebebe',
      paper: '#faf6ef',
      ink: '#3a1826',
      muted: '#844b58',
      accent: '#6d2e46',
      'accent-ink': '#faf6ef',
      secondary: '#4f7a5c',
      'secondary-ink': '#faf6ef',
      success: '#2f7d4a',
      warning: '#a3670a',
      danger: '#c0392b',
      rule: '#d5b9b2',
      'ribbon-bg': '#ece2d0',
      'ribbon-ink': '#3a1826',
      'bubble-bg': '#ead2cf',
      'bubble-ink': '#6d2e46',
      shadow: 'rgb(109 46 70 / 0.22)',
      scheme: 'light',
    },
    dark: {
      desk: '#1f1a1c',
      paper: '#2b2226',
      ink: '#f3e3ec',
      muted: '#c3a0b3',
      accent: '#d48aa8',
      'accent-ink': '#2b2226',
      secondary: '#9cc7a8',
      'secondary-ink': '#2b2226',
      success: '#6cc58a',
      warning: '#e8b04a',
      danger: '#ff7b6e',
      rule: '#4a3a42',
      'ribbon-bg': '#251e21',
      'ribbon-ink': '#f3e3ec',
      'bubble-bg': '#5a2a40',
      'bubble-ink': '#f8e5ee',
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
      secondary: '#8a3f72',
      'secondary-ink': '#fbf8ef',
      success: '#2a7a62',
      warning: '#a3670a',
      danger: '#b3302d',
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
      secondary: '#d38fc0',
      'secondary-ink': '#292824',
      success: '#6cc9a8',
      warning: '#e8b04a',
      danger: '#f07a72',
      rule: '#4a493f',
      'ribbon-bg': '#23231f',
      'ribbon-ink': '#e2dcbe',
      'bubble-bg': '#474533',
      'bubble-ink': '#e6e3c2',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Space indigo and dusty grape on parchment, with lilac and almond between, and almond on
  // indigo-tinted grey by night.
  lavender: {
    label: 'Lavender',
    light: {
      desk: '#e5d7d2',
      paper: '#f8f3f0',
      ink: '#22223b',
      muted: '#5e5568',
      accent: '#4a4e69',
      'accent-ink': '#f8f3f0',
      secondary: '#9a6b1f',
      'secondary-ink': '#f8f3f0',
      success: '#2f7d4a',
      warning: '#a3670a',
      danger: '#b3302d',
      rule: '#c9ada7',
      'ribbon-bg': '#f2e9e4',
      'ribbon-ink': '#22223b',
      'bubble-bg': '#e3d9e1',
      'bubble-ink': '#3a3550',
      shadow: 'rgb(34 34 59 / 0.25)',
      scheme: 'light',
    },
    dark: {
      desk: '#1c1b20',
      paper: '#26252c',
      ink: '#f2e9e4',
      muted: '#b3a5b0',
      accent: '#c9ada7',
      'accent-ink': '#26252c',
      secondary: '#e0b45c',
      'secondary-ink': '#26252c',
      success: '#6cc58a',
      warning: '#e8b04a',
      danger: '#f07a72',
      rule: '#45434f',
      'ribbon-bg': '#211f26',
      'ribbon-ink': '#f2e9e4',
      'bubble-bg': '#3a3a4d',
      'bubble-ink': '#f2e9e4',
      shadow: 'rgb(0 0 0 / 0.6)',
      scheme: 'dark',
    },
  },
  // Greys and near-blacks, cool with a touch of blue, and a touch of red in the comments.
  graphite: {
    label: 'Graphite',
    light: {
      desk: '#e2e3e6',
      paper: '#f7f7f8',
      ink: '#1d1e22',
      muted: '#55575e',
      accent: '#33353b',
      'accent-ink': '#f7f7f8',
      secondary: '#a63d40',
      'secondary-ink': '#f7f7f8',
      success: '#2f7d4a',
      warning: '#a3670a',
      danger: '#c0262d',
      rule: '#cfd1d6',
      'ribbon-bg': '#efeff1',
      'ribbon-ink': '#1d1e22',
      'bubble-bg': '#ece2e2',
      'bubble-ink': '#5a2e30',
      shadow: 'rgb(20 22 28 / 0.22)',
      scheme: 'light',
    },
    dark: {
      desk: '#18191b',
      paper: '#222326',
      ink: '#e6e7ea',
      muted: '#a4a6ad',
      accent: '#c9cbd1',
      'accent-ink': '#222326',
      secondary: '#e07a7c',
      'secondary-ink': '#222326',
      success: '#6cc58a',
      warning: '#e8b04a',
      danger: '#ff6b6b',
      rule: '#3a3c41',
      'ribbon-bg': '#1d1e21',
      'ribbon-ink': '#e6e7ea',
      'bubble-bg': '#3d2c2e',
      'bubble-ink': '#f0dcdc',
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
    `${base} { ${toCss(PALETTES.sage.light)} }`,
    ...Object.entries(PALETTES).flatMap(([name, palette]) => [
      rule(`${name}-light`, palette.light),
      rule(`${name}-dark`, palette.dark),
      ...auto(`${name}-auto`, palette),
    ]),
    ...auto('auto', PALETTES.sage),
  ].join('\n');
}

export const THEME_CSS = themeRules(':host', (name) => `:host([theme="${name}"])`);

/** The same presets for a whole page, selected by <html data-theme="...">. */
export const PAGE_THEME_CSS = themeRules(':root', (name) => `:root[data-theme="${name}"]`);

const registry = new Map();

// registerTheme('sepia', { paper: '#f4ecd8', ink: '#3b2f1e' }) then <flow-script theme="sepia">.
// Any color left out falls back to sage light.
export function registerTheme(name, colors) {
  registry.set(name, colors);
  document.querySelectorAll(`flow-script[theme="${CSS.escape(name)}"]`).forEach((el) => el.applyTheme());
}

export const getTheme = (name) => registry.get(name);
