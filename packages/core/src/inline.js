// Fountain emphasis: *italic*, **bold**, ***both***, _underline_, \ escapes.
// Works on raw line text and reports offsets, so callers can hide markers
// without ever changing the source.

const isSpace = (c) => c === undefined || c === ' ' || c === '\t';
const isWord = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

function runLength(s, i, to) {
  let n = 0;
  while (i + n < to && s[i + n] === '*') n++;
  return n;
}

function findStarClose(s, start, to, len) {
  let j = start;
  while (j < to) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] !== '*') { j++; continue; }
    const run = runLength(s, j, to);
    const fits = len === 1 ? run % 2 === 1 : run >= len;
    const close = j + run - len;
    const hasContent = /[^*]/.test(s.slice(start, close));
    if (fits && hasContent && !isSpace(s[j - 1])) return close;
    j += run;
  }
  return -1;
}

function findUnderscoreClose(s, start, to) {
  for (let j = start; j < to; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '_' && j > start && !isSpace(s[j - 1]) && !isWord(s[j + 1])) return j;
  }
  return -1;
}

const STYLE_BY_LEN = { 1: { italic: true }, 2: { bold: true }, 3: { bold: true, italic: true } };

function scan(s, from, to, style, out) {
  let i = from;
  let textStart = from;
  const flush = (end) => {
    if (end > textStart) out.runs.push({ start: textStart, end, ...style });
  };
  while (i < to) {
    const c = s[i];
    if (c === '\\' && i + 1 < to && /[\\*_]/.test(s[i + 1])) {
      flush(i);
      out.markers.push([i, i + 1]);
      textStart = i + 1;
      i += 2;
      continue;
    }
    let len = 0;
    let close = -1;
    let flags = null;
    if (c === '*') {
      const run = runLength(s, i, to);
      for (len = Math.min(run, 3); len > 0; len--) {
        if (isSpace(s[i + len])) continue;
        close = findStarClose(s, i + len, to, len);
        if (close >= 0) { flags = STYLE_BY_LEN[len]; break; }
      }
      if (close < 0) { i += run; continue; }
    } else if (c === '_' && !isWord(s[i - 1]) && !isSpace(s[i + 1])) {
      len = 1;
      close = findUnderscoreClose(s, i + 1, to);
      if (close < 0) { i++; continue; }
      flags = { underline: true };
    } else {
      i++;
      continue;
    }
    flush(i);
    out.markers.push([i, i + len], [close, close + len]);
    out.spans.push({ openStart: i, openEnd: i + len, closeStart: close, closeEnd: close + len, ...flags });
    scan(s, i + len, close, { ...style, ...flags }, out);
    i = close + len;
    textStart = i;
  }
  flush(to);
}

export function parseInline(s, from = 0, to = s.length) {
  const out = { runs: [], markers: [], spans: [] };
  scan(s, from, to, {}, out);
  out.runs.sort((a, b) => a.start - b.start);
  out.markers.sort((a, b) => a[0] - b[0]);
  return out;
}
