// Draws layout() output to a PDF. Kept out of the core index so pdf-lib is only
// loaded when somebody actually exports.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { parse } from './parser.js';
import { layout, COL } from './layout.js';

const COL_PT = 7.2;
const ROW_PT = 12;
const FONT_SIZE = 12;
const TOP_PT = 72;
const PAGE_NUMBER_TOP_PT = 36;

// Replaces what the built-in Courier can't encode, and records it so the caller
// can tell the writer rather than silently losing characters.
function encodable(font, text, problems) {
  try {
    font.encodeText(text);
    return text;
  } catch {
    let out = '';
    for (const ch of text) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += '?';
        problems.add(ch);
      }
    }
    return out;
  }
}

export async function renderPdf(source, options = {}) {
  const parsed = parse(source);
  const result = layout(parsed, options);
  const { profile } = result;
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Courier),
    bold: await doc.embedFont(StandardFonts.CourierBold),
    italic: await doc.embedFont(StandardFonts.CourierOblique),
    boldItalic: await doc.embedFont(StandardFonts.CourierBoldOblique),
  };
  const fontFor = (r) => (r.bold && r.italic ? fonts.boldItalic : r.bold ? fonts.bold : r.italic ? fonts.italic : fonts.regular);
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
        font: fonts.regular,
        color: black,
      });
    }
    for (const row of p.rows) {
      const baseline = H - TOP_PT - (row.y + 1) * ROW_PT + 2.5;
      for (const cell of row.cells) {
        let x = cell.x * COL_PT;
        for (const run of cell.runs) {
          const font = fontFor(run);
          const text = encodable(font, run.text, unsupported);
          if (text) page.drawText(text, { x, y: baseline, size: FONT_SIZE, font, color: black });
          const width = text.length * COL_PT;
          if (run.underline && text.trim()) {
            page.drawLine({ start: { x, y: baseline - 1.5 }, end: { x: x + width, y: baseline - 1.5 }, thickness: 0.6, color: black });
          }
          x += width;
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
