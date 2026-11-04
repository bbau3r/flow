// Draws layout() output to a PDF. Kept out of the core index so pdf-lib is only
// loaded when somebody actually exports.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parse } from './parser.js';
import { layout, COL } from './layout.js';

const COL_PT = 7.2;
const ROW_PT = 12;
const FONT_SIZE = 12;
const TOP_PT = 72;
const PAGE_NUMBER_TOP_PT = 36;

const STYLE_OF = (r) => (r.bold && r.italic ? 'boldItalic' : r.bold ? 'bold' : r.italic ? 'italic' : 'regular');
const STANDARD = {
  regular: StandardFonts.Courier,
  bold: StandardFonts.CourierBold,
  italic: StandardFonts.CourierOblique,
  boldItalic: StandardFonts.CourierBoldOblique,
};

function canEncode(font, ch) {
  try {
    font.encodeText(ch);
    return true;
  } catch {
    return false;
  }
}

// options.fonts holds WOFF files for { regular, bold, italic, boldItalic }, not WOFF2, which keeps
// this module free of any bundler or file system. Without them, or for characters they
// lack, text uses the Courier built into PDF readers, which has the same character width.
export async function renderPdf(source, { fonts: fontFiles, ...options } = {}) {
  const parsed = parse(source);
  const result = layout(parsed, options);
  const { profile } = result;
  const doc = await PDFDocument.create();
  if (fontFiles) doc.registerFontkit(fontkit);
  const embedded = {};
  const standard = {};
  const glyphs = {};
  const embeddedFont = async (style) => {
    if (!fontFiles?.[style]) return null;
    // Subsetting also converts the font. Without it, the web font's bytes go into the PDF
    // unchanged, and PDF readers can't use them.
    embedded[style] ??= await doc.embedFont(fontFiles[style], { subset: true });
    glyphs[style] ??= new Set(embedded[style].getCharacterSet());
    return embedded[style];
  };
  const standardFont = async (style) => {
    standard[style] ??= await doc.embedFont(STANDARD[style]);
    return standard[style];
  };
  // Splits text into stretches that one font can draw, marking what none of them can.
  const segments = async (text, style) => {
    const main = await embeddedFont(style);
    const out = [];
    for (const ch of text) {
      let font = main;
      let drawn = ch;
      if (!main || !glyphs[style].has(ch.codePointAt(0))) {
        const fallback = await standardFont(style);
        if (canEncode(fallback, ch)) {
          font = fallback;
        } else {
          unsupported.add(ch);
          font = main ?? fallback;
          drawn = '?';
        }
      }
      const last = out[out.length - 1];
      if (last?.font === font) last.text += drawn;
      else out.push({ font, text: drawn });
    }
    return out;
  };
  const W = profile.widthIn * 72;
  const H = profile.heightIn * 72;
  const unsupported = new Set();
  const black = rgb(0, 0, 0);

  for (const p of result.pages) {
    const page = doc.addPage([W, H]);
    if (p.showNumber) {
      const label = `${p.number}.`;
      page.drawText(label, {
        x: (COL.action + profile.actionWidth - label.length) * COL_PT,
        y: H - PAGE_NUMBER_TOP_PT - ROW_PT,
        size: FONT_SIZE,
        font: (await embeddedFont('regular')) ?? (await standardFont('regular')),
        color: black,
      });
    }
    for (const row of p.rows) {
      const baseline = H - TOP_PT - (row.y + 1) * ROW_PT + 2.5;
      for (const cell of row.cells) {
        let x = cell.x * COL_PT;
        for (const run of cell.runs) {
          for (const { font, text } of await segments(run.text, STYLE_OF(run))) {
            page.drawText(text, { x, y: baseline, size: FONT_SIZE, font, color: black });
            const width = text.length * COL_PT;
            if (run.underline && text.trim()) {
              page.drawLine({ start: { x, y: baseline - 1.5 }, end: { x: x + width, y: baseline - 1.5 }, thickness: 0.6, color: black });
            }
            x += width;
          }
        }
      }
    }
  }

  const plain = (key) => parsed.titlePage.find((e) => e.key === key)?.lines.map((i) => parsed.lines[i].text).join(' ').trim();
  const title = plain('title');
  const author = plain('author') ?? plain('authors');
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  doc.setCreator('Flow');
  doc.setProducer('Flow');

  return { bytes: await doc.save(), pageCount: result.pages.length, unsupported: [...unsupported] };
}
