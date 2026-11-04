// Courier Prime for embedding in PDFs, loaded only when someone exports. These are WOFF
// rather than the WOFF2 used on screen, because the PDF library can't correctly rebuild
// a font from WOFF2's transformed tables, and PDF readers then reject the result.

import regular from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?inline';
import italic from '@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff?inline';
import bold from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?inline';
import boldItalic from '@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff?inline';

const decode = (dataUri) => Uint8Array.from(atob(dataUri.split(',')[1]), (c) => c.charCodeAt(0));

export const pdfFonts = () => ({
  regular: decode(regular),
  bold: decode(bold),
  italic: decode(italic),
  boldItalic: decode(boldItalic),
});
