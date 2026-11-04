// A theme is a set of colors applied as --flow-* custom properties. Presets ship
// in the stylesheet; pages can restyle by setting the properties in their own CSS
// or by registering a named theme here.

const LIGHT = {
  desk: '#efe4cb',
  paper: '#fffaf0',
  ink: '#2a1f0e',
  muted: '#7a5c22',
  accent: '#b45309',
  'accent-ink': '#fffaf0',
  rule: '#dfcda4',
  'ribbon-bg': '#fdf3dc',
  'ribbon-ink': '#3d2c10',
  'bubble-bg': '#fde9b4',
  'bubble-ink': '#4a3208',
  shadow: 'rgb(90 60 10 / 0.25)',
  scheme: 'light',
};

const DARK = {
  desk: '#100c05',
  paper: '#1c160b',
  ink: '#ffcc7a',
  muted: '#c0964a',
  accent: '#ffb000',
  'accent-ink': '#1c160b',
  rule: '#4a3814',
  'ribbon-bg': '#191308',
  'ribbon-ink': '#ffcc7a',
  'bubble-bg': '#3d2d0e',
  'bubble-ink': '#ffdb9e',
  shadow: 'rgb(0 0 0 / 0.6)',
  scheme: 'dark',
};

const toCss = (theme) =>
  Object.entries(theme)
    .map(([k, v]) => (k === 'scheme' ? `color-scheme:${v};` : `--flow-${k}:${v};`))
    .join('');

export const THEME_CSS = `
:host { ${toCss(LIGHT)} }
:host([theme="amber-light"]) { ${toCss(LIGHT)} }
:host([theme="amber-dark"]) { ${toCss(DARK)} }
@media (prefers-color-scheme: dark) { :host([theme="auto"]) { ${toCss(DARK)} } }
`;

const registry = new Map();

// registerTheme('sepia', { paper: '#f4ecd8', ink: '#3b2f1e' }) then <flow-script theme="sepia">.
// Any color left out falls back to amber light.
export function registerTheme(name, colors) {
  registry.set(name, colors);
  document.querySelectorAll(`flow-script[theme="${CSS.escape(name)}"]`).forEach((el) => el.applyTheme());
}

export const getTheme = (name) => registry.get(name);
