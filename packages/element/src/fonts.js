// Courier Prime (the script and ribbon icons) and Roboto (the interface) ship inside the build so pages look right offline and on devices
// with no Courier. Fonts registered with document.fonts reach into shadow roots,
// which an @font-face rule inside the shadow stylesheet would not.

import regular from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2?inline';
import italic from '@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff2?inline';
import bold from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2?inline';
import boldItalic from '@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff2?inline';
import robotoRegular from '@fontsource/roboto/files/roboto-latin-400-normal.woff2?inline';
import robotoItalic from '@fontsource/roboto/files/roboto-latin-400-italic.woff2?inline';
import robotoBold from '@fontsource/roboto/files/roboto-latin-700-normal.woff2?inline';

const FACES = [
  ['Courier Prime', regular, '400', 'normal'],
  ['Courier Prime', italic, '400', 'italic'],
  ['Courier Prime', bold, '700', 'normal'],
  ['Courier Prime', boldItalic, '700', 'italic'],
  ['Roboto', robotoRegular, '400', 'normal'],
  ['Roboto', robotoItalic, '400', 'italic'],
  ['Roboto', robotoBold, '700', 'normal'],
];

export function registerFonts() {
  for (const [family, src, weight, style] of FACES) {
    const face = new FontFace(family, `url(${src})`, { weight, style, display: 'swap' });
    document.fonts.add(face);
    face.load().catch(() => {}); // the fallbacks in the stylesheet still work
  }
}
