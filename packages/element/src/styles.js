import { CONTROLS_CSS, token } from './controls.js';
import { THEME_CSS } from './themes.js';

// Layout maths: at 12pt Courier, 1em = 1 row = 1/6in and a column = 0.6em = 0.1in,
// so inches convert by 6em. --fl-page-w/h come from the paper profile. The sheet
// font-size scales with the container so a whole page still fits a phone.
export const STYLES = `
${THEME_CSS}
${CONTROLS_CSS}
:host {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  background: var(--flow-desk);
  color: var(--flow-ink);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  --fl-script-font: var(--flow-font, "Courier Prime", "Courier New", Courier, monospace);
  --fl-page-w: 51em;
  --fl-page-h: 66em;
  --fl-action-w: 36.6em;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

.fl-scroll { flex: 1; min-height: 0; overflow: auto; container-type: inline-size; scroll-padding-top: var(--fl-inset-top, 0px); scroll-padding-bottom: var(--fl-inset-bottom, 0px); }
/* geometricPrecision keeps character widths fractional. Without it, Linux browsers at
   standard density round 9.6px up to 10px, which breaks every column on the page. */
.fl-script { font-family: var(--fl-script-font); font-variant-ligatures: none; line-height: 1; text-rendering: geometricPrecision; }
:host(:not([view="flow"], [view="source"])) .fl-script { font-size: calc(min(16px, var(--fl-area-w, 100cqw) / 52.5) * var(--fl-scale, 1)); }

/* With the bars, the script fills the room between them when short, so they rest at the top
   and bottom, and grows past them when long. A grid would confine each to its own row. */
.fl-has-bars { display: flex; flex-direction: column; }
.fl-has-bars > * { flex: 1 0 auto; }
.fl-has-bars > .fl-chrome, .fl-has-bars > .fl-footer { flex: none; }
.fl-has-bars > .fl-flow, .fl-has-bars > .fl-source { min-height: 0; }
/* The bars float over the script: only the pills take clicks, and the script passes beneath
   them. Being query containers lets labels collapse by width. */
.fl-chrome, .fl-footer {
  position: sticky; left: 0; z-index: 20;
  container-type: inline-size;
  pointer-events: none;
  --flow-pill-shadow: ${token('float-shadow')};
}
.fl-chrome { top: 0; }
.fl-footer { bottom: 0; --fl-control-size: 22px; --fl-control-pad: 6px; --fl-pill-font: 11.5px; --fl-pill-pad: 2px; }
/* A bar with an open menu comes forward, so the menu can reach over the other bar. */
.fl-chrome:has(.fl-menu-popup:not([hidden])), .fl-footer:has(.fl-menu-popup:not([hidden])) { z-index: 40; }
::slotted(*) { pointer-events: auto; }
/* Two rows by default, with the formatting controls leaning left on the second. */
.fl-topbar {
  display: grid; align-items: center; gap: 6px 8px; padding: 8px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "start end" "format format";
}
.fl-topbar:has(> .fl-ribbon[hidden]) { row-gap: 0; }
/* Stretched, so that the document and tabs pills always match in height. */
.fl-topbar-start { grid-area: start; display: flex; align-items: stretch; gap: 8px; min-width: 0; }
.fl-topbar-tabs { flex: none; display: flex; }
.fl-topbar-tabs[hidden], .fl-ribbon[hidden] { display: none; }
.fl-topbar-end { grid-area: end; display: flex; justify-content: flex-end; }
.fl-ribbon { grid-area: format; display: flex; align-items: center; gap: 8px; }
.fl-format-pills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
.fl-format-pills[hidden] { display: none; }
.fl-format-animating { flex-wrap: nowrap; }
.fl-format-animating > * { flex: none; }
/* A bare icon over the page, unlike the pills around it, until the pointer finds it. */
.fl-format-toggle { pointer-events: auto; color: var(--flow-ink); }
.fl-format-toggle .fl-svg { transition: transform 220ms ease; }
.fl-format-toggle[aria-expanded="false"] .fl-svg { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .fl-format-toggle .fl-svg { transition: none; } }
/* With room for everything, one row. The title gives way first if it's long. */
@container (min-width: 1000px) {
  .fl-topbar {
    grid-template-columns: minmax(0, max-content) auto minmax(max-content, 1fr);
    grid-template-areas: "start format end";
  }
}
.fl-ribbon .fl-b { font-weight: 700; }
.fl-ribbon .fl-i { font-style: italic; }
.fl-ribbon .fl-u { text-decoration: underline; }
.fl-ribbon .fl-strike { text-decoration: line-through; }
.fl-topics .fl-menu-trigger { justify-content: flex-start; min-width: 10.5em; }
.fl-topic-name { flex: 1; text-align: left; }
/* Once the tabs are a dropdown, the document gets all the room that's left. */
@container (max-width: 600px) {
  .fl-topics .fl-menu-trigger { min-width: 8em; }
  /* One row that scrolls sideways. The padding keeps pill shadows from being cut off, and
     the margins let pills run to the screen's edge. */
  .fl-ribbon {
    flex-wrap: nowrap; column-gap: 6px;
    margin: -6px -12px -12px; padding: 6px 12px 12px;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin; scrollbar-color: ${token('scrollbar')} transparent;
    pointer-events: auto;
  }
  .fl-ribbon > *, .fl-format-pills > * { flex: none; }
  .fl-format-pills { flex-wrap: nowrap; column-gap: 6px; }
  /* The row would clip a menu anchored inside it, so it anchors to the whole bar instead. */
  .fl-ribbon .fl-menu { position: static; }
}
.fl-statusbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 6px 12px; }
.fl-scale { min-width: 3.5em; font-variant-numeric: tabular-nums; }
.fl-status { padding: 0 8px; color: var(--flow-muted); }
.fl-spacer { flex: 1; }
.fl-field { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.fl-field select { margin-left: auto; font: inherit; color: inherit; background: var(--flow-paper); border: 1px solid var(--flow-rule); border-radius: 4px; padding: 2px 4px; }

/* Read-only pages */
.fl-pages { display: flex; flex-direction: column; align-items: safe center; gap: 1.5em; padding: 1.5em 0; }
.fl-page, .fl-sheet {
  position: relative;
  width: var(--fl-page-w);
  background: var(--flow-paper);
  color: var(--flow-ink);
  box-shadow: 0 1px 6px var(--flow-shadow);
}
.fl-page { position: relative; height: var(--fl-page-h); flex: none; overflow: hidden; }
.fl-row { position: absolute; left: 0; right: 0; height: 1em; }
.fl-cell { position: absolute; top: 0; white-space: pre; }
.fl-page-number { position: absolute; top: 3em; white-space: pre; }
.fl-bold { font-weight: 700; }
.fl-italic { font-style: italic; }
.fl-underline { text-decoration: underline; }

/* Comment bubbles. The summary keeps its place and size whether open or closed, and
   the note opens as an overlay behind it, so together they read as one pill and
   nothing around them moves. */
.fl-bubble { position: relative; isolation: isolate; font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 0.8em; line-height: 1.3; }
.fl-bubble[open] { z-index: 6; }
.fl-bubble summary {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 0.35em; height: 1.7em; padding: 0 0.6em;
  border-radius: 0.85em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  cursor: pointer; list-style: none; user-select: none; white-space: nowrap;
}
.fl-bubble summary::-webkit-details-marker { display: none; }
.fl-bubble[open] summary { background: transparent; }
.fl-bubble-icon, .fl-bubble-close { display: inline-flex; justify-content: center; flex: none; width: 1em; }
.fl-bubble-close { display: none; width: 0.8em; font-size: 1.25em; font-weight: 700; line-height: 1; } /* same box as the icon */
.fl-bubble[open] .fl-bubble-icon { display: none; }
.fl-bubble[open] .fl-bubble-close { display: inline-flex; }
.fl-bubble-chip {
  display: inline-flex; align-items: center; gap: 0.35em; max-width: 16em;
  padding: 0.1em 0.6em; border-radius: 1em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  cursor: pointer; user-select: none; white-space: nowrap;
}
.fl-bubble-preview { overflow: hidden; text-overflow: ellipsis; }
.fl-bubble[open] .fl-bubble-preview { visibility: hidden; }
.fl-bubble-body {
  position: absolute; z-index: 0; top: 0;
  border-radius: 0.85em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  white-space: pre-wrap; overflow-wrap: anywhere;
  box-shadow: 0 3px 10px var(--flow-shadow);
}
.fl-page .fl-bubbles { position: absolute; top: -0.1em; right: 0.5em; display: flex; flex-direction: column; align-items: flex-end; z-index: 5; }
.fl-page .fl-bubble summary { justify-content: center; width: 2.2em; padding: 0; }
.fl-page .fl-bubble-preview { display: none; }
.fl-page .fl-bubble-body { right: 0; width: 20em; min-height: 1.7em; padding: 0.2em 2.4em 0.55em 0.85em; }
.fl-page:has(.fl-bubble[open]) { overflow: visible; z-index: 1; }

/* Script lines, shared by the editor and the read-only flow view */
.fl-line { white-space: pre-wrap; overflow-wrap: break-word; min-height: 1em; }
.fl-line.fl-scene:not(.fl-forced) { text-transform: uppercase; }
.fl-line.fl-transition { text-align: right; text-transform: uppercase; }
.fl-line.fl-centered { text-align: center; }
.fl-line.fl-lyrics { font-style: italic; }
.fl-line .fl-b { font-weight: 700; }
.fl-line .fl-i { font-style: italic; }
.fl-line .fl-u { text-decoration: underline; }
.fl-scene-number { color: var(--flow-muted); }
.fl-line.fl-section, .fl-line.fl-synopsis {
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); color: var(--flow-muted); text-transform: none;
}
.fl-line.fl-section { font-weight: 600; }
.fl-line.fl-section-1 { font-size: 1.15em; }
.fl-line.fl-section-3 { font-weight: 400; }
.fl-line.fl-synopsis { font-style: italic; }
.fl-line.fl-page-break:not(.fl-active) { position: relative; color: transparent; }
.fl-line.fl-page-break:not(.fl-active)::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 2px dashed var(--flow-rule);
}
.fl-line.fl-title-title { text-align: center; font-size: 1em; }
.fl-line.fl-title-credit, .fl-line.fl-title-author, .fl-line.fl-title-authors, .fl-line.fl-title-source { text-align: center; }

/* Page view indents, measured from the page edge like the printed page */
.fl-sheet .fl-line.fl-character { margin-left: 12em; max-width: 19.8em; }
.fl-sheet .fl-line.fl-parenthetical { margin-left: 9em; max-width: 15.6em; }
.fl-sheet .fl-line.fl-dialogue, .fl-sheet .fl-line.fl-in-dialogue { margin-left: 6em; max-width: 21.6em; }
.fl-sheet .fl-line { max-width: var(--fl-action-w); }

/* The cover page in page view: placed by row, as in print, and always a full page */
.fl-sheet .fl-line.fl-title-placed {
  position: absolute; top: calc((6 + var(--fl-title-y)) * 1em);
  left: 0; right: 0; max-width: none; text-align: center;
}
.fl-sheet .fl-line.fl-title-placed.fl-title-notes, .fl-sheet .fl-line.fl-title-placed.fl-title-copyright {
  left: 9em; right: auto; width: 18em; text-align: left;
}
.fl-sheet .fl-line.fl-title-placed.fl-title-draft-date, .fl-sheet .fl-line.fl-title-placed.fl-title-date, .fl-sheet .fl-line.fl-title-placed.fl-title-contact {
  left: calc(9em + var(--fl-action-w) - 18em); right: auto; width: 18em; text-align: left;
}
.fl-sheet .fl-title-separator:not(.fl-active) { height: 0; min-height: 0; overflow: hidden; }
.fl-sheet .fl-page-gap.fl-title-gap { margin-top: calc(var(--fl-page-h) - 6em); }

/* Flow view: same relationships, proportional to whatever width is available */
.fl-flow { max-width: 44em; margin: 0 auto; padding: 1.5em; background: var(--flow-paper); color: var(--flow-ink); min-height: 100%; width: 100%; line-height: 1.35; font-size: calc(16px * var(--fl-scale, 1)); }
/* The Fountain text itself: an ordinary column, with nothing placed or hidden */
.fl-source { max-width: 52em; margin: 0 auto; padding: 1.5em; background: var(--flow-paper); color: var(--flow-ink); min-height: 100%; width: 100%; line-height: 1.35; font-size: calc(16px * var(--fl-scale, 1)); white-space: pre-wrap; overflow-wrap: break-word; }
.fl-flow .fl-line.fl-character { margin-left: 32%; }
.fl-flow .fl-line.fl-parenthetical { margin-left: 24%; margin-right: 20%; }
.fl-flow .fl-line.fl-dialogue, .fl-flow .fl-line.fl-in-dialogue { margin-left: 15%; margin-right: 15%; }
.fl-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
.fl-dual .fl-line { margin-right: 0 !important; }
.fl-dual .fl-line.fl-character { margin-left: 25% !important; }
.fl-dual .fl-line.fl-parenthetical { margin-left: 10% !important; }
.fl-dual .fl-line.fl-dialogue, .fl-dual .fl-line.fl-in-dialogue { margin-left: 0 !important; }
.fl-flow .fl-bubble { display: inline-flex; vertical-align: top; max-width: 16em; margin: 0 0.25em; }
.fl-flow .fl-bubble summary { min-width: 0; }
.fl-flow .fl-bubble-body { left: 0; width: min(24em, 80cqw); padding: 1.9em 0.85em 0.55em; }

/* Editor */
.fl-sheet {
  position: relative;
  --fl-pad-right: calc(var(--fl-page-w) - 9em - var(--fl-action-w));
  margin: 1.5em auto; padding: 6em var(--fl-pad-right) 6em 9em; min-height: var(--fl-page-h);
}
.fl-editor-host .ProseMirror { outline: none; white-space: pre-wrap; word-wrap: break-word; caret-color: var(--flow-accent); }
.fl-editor-host .ProseMirror ::selection { background: color-mix(in srgb, var(--flow-accent) 30%, transparent); }
.fl-marker { color: var(--flow-accent); opacity: 0.75; font-weight: 400; font-style: normal; text-decoration: none; }
.fl-line:not(.fl-active) .fl-marker { display: none; }
.fl-comment-src { display: none; }
.fl-active .fl-comment-src { display: inline; color: var(--flow-bubble-ink); background: var(--flow-bubble-bg); font-style: normal; font-weight: 400; }
.fl-active .fl-bubble-chip { display: none; }
.fl-comment-hidden:not(.fl-active) { display: none; }
.fl-editor-host .fl-bubble-chip { margin: 0 0.25em; font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 0.8em; line-height: 1.3; vertical-align: baseline; }
.fl-boneyard { color: var(--flow-muted); opacity: 0.75; text-decoration: line-through; }
.fl-page-gap {
  display: flex; align-items: center; justify-content: flex-end;
  height: 3em; margin: 2em calc(-1 * var(--fl-pad-right, 0em)) 2em -9em; padding: 0 1em;
  background: var(--flow-desk); color: var(--flow-muted);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  box-shadow: inset 0 3px 4px -3px var(--flow-shadow), inset 0 -3px 4px -3px var(--flow-shadow);
  user-select: none;
}
.fl-flow .fl-page-gap, .fl-flow .fl-page-one { display: none; }
.fl-flow .fl-title-gap span { display: none; }
.fl-page-one {
  position: absolute; top: 1em; right: 1em;
  color: var(--flow-muted);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  user-select: none;
}
/* Without pages to separate them, breaks in flow view are drawn as a dashed line. */
.fl-break-rule, .fl-flow .fl-page-gap.fl-title-gap {
  display: block; height: 0; margin: 1em 0; padding: 0;
  background: none; box-shadow: none;
  border-top: 2px dashed var(--flow-rule);
}

@media print {
  :host { background: none; }
  .fl-chrome, .fl-footer { display: none; }
  .fl-scroll { display: block; overflow: visible; container-type: normal; }
  .fl-script { font-size: 12pt !important; }
  .fl-pages { display: block; padding: 0; }
  .fl-page { box-shadow: none; break-after: page; background: #fff; color: #000; }
  .fl-bubbles { display: none; }
}
`;
