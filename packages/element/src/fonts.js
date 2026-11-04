// Courier Prime ships inside the build so pages look right offline and on devices
// with no Courier. Fonts registered with document.fonts reach into shadow roots,
// which an @font-face rule inside the shadow stylesheet would not.

import regular from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2?inline';
import italic from '@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff2?inline';
import bold from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2?inline';
import boldItalic from '@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff2?inline';

export function registerFonts() {
  const faces = [
    [regular, { weight: '400', style: 'normal' }],
    [italic, { weight: '400', style: 'italic' }],
    [bold, { weight: '700', style: 'normal' }],
    [boldItalic, { weight: '700', style: 'italic' }],
  ].map(([src, desc]) => new FontFace('Courier Prime', `url(${src})`, { ...desc, display: 'swap' }));
  for (const face of faces) {
    document.fonts.add(face);
    face.load().catch(() => {}); // the Courier fallbacks have identical metrics
  }
}
