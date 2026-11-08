// Draws Flow's mark, an F whose three ends curl into themselves like water, and writes
// everything made from it: the app icon (public/icons/icon.svg and its PNGs, in the fixed
// brand colors) and src/mark-paths.js, the shapes the home page colors from the theme.
//
// Each stroke is a centerline (spirals joined by a spline) with a width profile, split
// lengthwise into a light band and a deep band. The split drifts across the stem so the
// ribbon reads as twisting. Run with `npm run icons -w @flow/pwa` after changing the shape.

import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const D = Math.PI / 180;
const here = (path) => new URL(path, import.meta.url);

// Centripetal Catmull-Rom through the points, sampled densely.
function spline(pts, per = 24) {
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const d = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * (k / per);
      const L = (a, b, ta, tb) => a.map((v, j) => ((tb - t) * v + (t - ta) * b[j]) / (tb - ta));
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      out.push(L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Even arc-length resampling.
function resample(pts, n) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1], out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (total * i) / (n - 1);
    while (j < acc.length - 2 && acc[j + 1] < s) j++;
    const u = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
  }
  return out;
}

// Points along a spiral; angles in degrees, turning clockwise on screen as the angle grows.
function spiral(cx, cy, a0, a1, r0, r1, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n, a = (a0 + (a1 - a0) * u) * D, r = r0 + (r1 - r0) * u;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

// The centerline offset by a fraction of the half-width (a number, or a function of s in 0..1).
function offsetter(center, halfWidth) {
  const n = center.length;
  const normals = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  });
  return (frac) => center.map((p, i) => {
    const s = i / (n - 1), w = halfWidth(s) * (typeof frac === 'function' ? frac(s) : frac);
    return [p[0] + normals[i][0] * w, p[1] + normals[i][1] * w];
  });
}

// A closed shape between two edges, smoothed with quadratic curves through the midpoints.
function band(edgeA, edgeB) {
  const pts = [...edgeA, ...edgeB.slice().reverse()];
  const f = (v) => Math.round(v * 10) / 10;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}L${f(pts.at(-1)[0])} ${f(pts.at(-1)[1])}Z`;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (s, a, b) => smooth(clamp((s - a) / (b - a)));

function stroke(center, halfWidth, split) {
  const at = offsetter(center, halfWidth);
  return {
    light: band(at(1), at(split)),
    deep: band(at(split), at(-1)),
    sheen: band(at(0.92), at((s) => 0.92 - 0.22 * Math.sin(Math.PI * s))),
  };
}

// Main stroke: from the eye of the top curl outward, down the stem, into the bottom curl.
const mainLine = resample(spline([
  ...spiral(312, 112, 290, -166, 13, 64, 24),
  [232, 158], [234, 224], [250, 292], [256, 348], [242, 400],
  ...spiral(178, 400, 42, 424, 52, 13, 22),
]), 160);
const main = stroke(mainLine,
  (s) => 2 + 21 * Math.pow(Math.sin(Math.PI * clamp(s * 1.03 - 0.015)), 0.75),
  (s) => 0.35 - 0.95 * ramp(s, 0.36, 0.66));

// Middle branch: leaves the stem, arcs right and curls back in.
const branchLine = resample(spline([[252, 300], [266, 262], ...spiral(338, 250, -150, 206, 50, 14, 20)]), 90);
const branch = stroke(branchLine,
  (s) => 2 + 16 * Math.pow(Math.sin(Math.PI * clamp(0.5 + s * 0.5)), 0.7),
  (s) => 0.1 + 0.25 * ramp(s, 0, 0.5));

// The art's bounds, padded for the widest stroke.
const all = [...mainLine, ...branchLine];
const pad = 24;
const box = {
  x: Math.floor(Math.min(...all.map((p) => p[0])) - pad),
  y: Math.floor(Math.min(...all.map((p) => p[1])) - pad),
};
box.w = Math.ceil(Math.max(...all.map((p) => p[0])) + pad) - box.x;
box.h = Math.ceil(Math.max(...all.map((p) => p[1])) + pad) - box.y;

// Gradients run in art coordinates, top to bottom (main) and stem to tip (branch).
const GRADIENTS = {
  light: [340, 50, 160, 470],
  deep: [300, 40, 200, 470],
  branchLight: [270, 200, 380, 290],
  branchDeep: [370, 220, 260, 300],
};

// The brand colors, used by the app icon. The home page takes these from the theme instead.
const BRAND = {
  light: ['#1f8fe0', '#2fc6e0', '#6ff0c8'],
  deep: ['#0a3f86', '#0e6f9a', '#139a8c'],
  branchLight: ['#36d0d4', '#7af2c0'],
  branchDeep: ['#12898e', '#0b4f8a'],
};

function iconSvg({ size = 512, scale = 1, background = null, radius = 0 } = {}) {
  const stops = (colors) => colors.map((c, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${c}"/>`).join('');
  const grads = Object.entries(GRADIENTS).map(([id, [x1, y1, x2, y2]]) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(BRAND[id])}</linearGradient>`).join('');
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const s = (scale * 512) / Math.max(box.w, box.h) * 0.92;
  const place = `translate(256 256) scale(${+s.toFixed(4)}) translate(${-cx} ${-cy})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
<defs>${grads}<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter><filter id="contact" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter><path id="ml" d="${main.light}"/><path id="md" d="${main.deep}"/><path id="bl" d="${branch.light}"/><path id="bd" d="${branch.deep}"/></defs>
${background ? `<rect width="512" height="512" rx="${radius}" fill="${background}"/>` : ''}<g transform="${place}">
<g filter="url(#blur)" fill="#04304f" opacity=".28" transform="translate(4 9)"><use href="#ml"/><use href="#md"/><use href="#bl"/><use href="#bd"/></g>
<use href="#bd" fill="url(#branchDeep)"/><use href="#bl" fill="url(#branchLight)"/><path d="${branch.sheen}" fill="#fff" opacity=".35"/>
<g filter="url(#contact)" fill="#03283f" opacity=".45" transform="translate(3 3)"><use href="#ml"/><use href="#md"/></g>
<use href="#md" fill="url(#deep)"/><use href="#ml" fill="url(#light)"/><path d="${main.sheen}" fill="#fff" opacity=".4"/>
</g></svg>
`;
}

writeFileSync(here('../public/icons/icon.svg'), iconSvg());

writeFileSync(here('../src/mark-paths.js'), `// Generated by scripts/icons.mjs: the shapes of Flow's mark. Don't edit by hand.

export const VIEWBOX = ${JSON.stringify([box.x, box.y, box.w, box.h].join(' '))};
export const GRADIENTS = ${JSON.stringify(GRADIENTS)};
export const MAIN = ${JSON.stringify({ light: main.light, deep: main.deep }, null, 2)};
export const BRANCH = ${JSON.stringify({ light: branch.light, deep: branch.deep }, null, 2)};
`);

// PNGs: plain icons on transparent, the maskable one inside its safe circle, and Apple's
// opaque touch icon. The pale tile keeps the deep blue top readable.
const TILE = '#eef5f7';
const pngs = [
  ['icon-192.png', iconSvg({ size: 192 })],
  ['icon-512.png', iconSvg({ size: 512 })],
  ['maskable-512.png', iconSvg({ size: 512, scale: 0.74, background: TILE })],
  ['apple-touch-180.png', iconSvg({ size: 180, scale: 0.84, background: TILE })],
];
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const page = await browser.newPage();
for (const [name, svg] of pngs) {
  const size = +svg.match(/width="(\d+)"/)[1];
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  await page.screenshot({ path: here(`../public/icons/${name}`).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: true });
}
await browser.close();
console.log('Wrote icon.svg, src/mark-paths.js and', pngs.map(([n]) => n).join(', '));
