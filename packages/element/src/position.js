// Keeping your place between tabs and views. Each one draws the script differently, so a
// place is a source line rather than a distance: the line at the top of the room below the
// bars, and how far it sits from there. Wherever you go next shows that line in the same spot,
// or the nearest one it draws.

/**
 * The line being read in `entries` ({ line, node } in order down the screen), measured from
 * `top`, the screen position just below the top bar. A script scrolled all the way up stays
 * at the top.
 */
export function placeOf(scroll, entries, top) {
  if (scroll.scrollTop <= 0) return { atTop: true };
  const shown = measure(entries);
  const at = shown.find((entry) => entry.bottom > top);
  if (!at) return null;
  const { top: lineTop, height } = span(shown, at.line);
  return { line: at.line, offset: lineTop - top, height };
}

/**
 * Scrolls so that `place` sits where it was. Without its own line, Outline shows the card the
 * line belongs to, and the other views the next line they draw, since lines they leave out,
 * such as sections and synopses, lead into what follows. Returns the line it shows.
 */
export function restorePlace(scroll, entries, place, top, { within = false } = {}) {
  if (!place) return null;
  if (place.atTop) {
    scroll.scrollTop = 0;
    return null;
  }
  const shown = measure(entries);
  if (!shown.length) return null;
  const before = shown.filter((entry) => entry.line <= place.line).at(-1);
  const after = shown.find((entry) => entry.line >= place.line);
  const target = (within ? before ?? after : after ?? before).line;
  const { top: lineTop, height } = span(shown, target);
  // A line partly scrolled past keeps the same share of it hidden, however tall it is now.
  let offset = 0;
  if (target === place.line) offset = place.offset < 0 && place.height ? (place.offset / place.height) * height : place.offset;
  scroll.scrollTop += lineTop - top - offset;
  return target;
}

// Only what's drawn counts, which leaves out folded cards and lines hidden in this view.
function measure(entries) {
  const shown = [];
  for (const { line, node } of entries) {
    if (!node.getClientRects().length) continue;
    const rect = node.getBoundingClientRect();
    if (rect.height) shown.push({ line, top: rect.top, bottom: rect.bottom });
  }
  return shown;
}

// A line can wrap onto several rows, and across a page break.
function span(shown, line) {
  const rows = shown.filter((entry) => entry.line === line);
  const top = rows[0].top;
  return { top, height: rows.at(-1).bottom - top };
}
