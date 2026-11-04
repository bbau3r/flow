import { THEME_CSS } from './themes.js';

// Layout maths: at 12pt Courier, 1em = 1 row = 1/6in and a column = 0.6em = 0.1in,
// so inches convert by 6em. --fl-page-w/h come from the paper profile. The sheet
// font-size scales with the container so a whole page still fits a phone.
export const STYLES = `
${THEME_CSS}
:host {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  background: var(--flow-desk);
  color: var(--flow-ink);
  font-family: system-ui, sans-serif;
  --fl-script-font: var(--flow-font, "Courier Prime", "Courier New", Courier, monospace);
  --fl-page-w: 51em;
  --fl-page-h: 66em;
  --fl-action-w: 36.6em;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

.fl-scroll { flex: 1; min-height: 0; overflow: auto; container-type: inline-size; }
/* geometricPrecision keeps character widths fractional. Without it, Linux browsers at
   standard density round 9.6px up to 10px, which breaks every column on the page. */
.fl-script { font-family: var(--fl-script-font); font-variant-ligatures: none; line-height: 1; text-rendering: geometricPrecision; }
:host([view="page"]) .fl-script, :host(:not([view])) .fl-script { font-size: min(16px, calc(100cqw / 52.5)); }

/* Ribbon */
.fl-ribbon {
  position: sticky; top: 0; z-index: 20;
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 0;
  padding: 6px 8px;
  background: var(--flow-ribbon-bg);
  color: var(--flow-ribbon-ink);
  border-bottom: 1px solid var(--flow-rule);
  font-size: 13px;
}
.fl-ribbon button, .fl-menu summary {
  appearance: none; font: inherit; color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 5px;
  padding: 4px 6px; min-height: 28px; cursor: pointer; white-space: nowrap;
  list-style: none;
}
.fl-menu summary::-webkit-details-marker { display: none; }
.fl-ribbon button, .fl-menu summary { display: inline-flex; align-items: center; }
.fl-ribbon button:hover, .fl-menu summary:hover { background: color-mix(in srgb, var(--flow-accent) 15%, transparent); }
.fl-ribbon button:focus-visible, .fl-menu summary:focus-visible, .fl-bubble summary:focus-visible { outline: 2px solid var(--flow-accent); outline-offset: 1px; }
.fl-ribbon button[aria-pressed="true"] { background: var(--flow-accent); color: var(--flow-accent-ink); }
.fl-ribbon button:disabled { opacity: 0.4; cursor: default; }
.fl-ribbon .fl-b { font-weight: 700; }
.fl-ribbon .fl-i { font-style: italic; font-family: Georgia, serif; }
.fl-ribbon .fl-u { text-decoration: underline; }
.fl-group { display: flex; align-items: center; gap: 2px; padding: 0 6px; }
.fl-group { border-right: 1px solid var(--flow-rule); }
.fl-group:first-child { padding-left: 0; }
.fl-group:last-child, .fl-group:has(+ .fl-spacer) { border-right: 0; }
.fl-group:last-child { padding-right: 0; }
.fl-icon {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.5em; height: 1.5em; padding: 0 0.2em; margin-right: 0.4em;
  border: 1px solid var(--flow-accent); border-radius: 3px;
  background: color-mix(in srgb, var(--flow-accent) 12%, transparent);
  color: var(--flow-accent);
  font-size: 0.95em; font-weight: 700; line-height: 1;
}
.fl-icon-glyph { display: block; white-space: pre; }
.fl-ribbon button[aria-pressed="true"] .fl-icon { color: inherit; border-color: currentColor; background: transparent; }
.fl-spacer { flex: 1; }
.fl-menu { position: relative; }
.fl-menu-body {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30;
  display: grid; gap: 8px; width: 15rem; max-width: calc(100vw - 16px); padding: 12px; overflow-y: auto;
  background: var(--flow-ribbon-bg); border: 1px solid var(--flow-rule); border-radius: 8px;
  box-shadow: 0 6px 20px var(--flow-shadow);
}
.fl-menu-body label { display: flex; align-items: center; gap: 8px; }
.fl-menu-body select { font: inherit; color: inherit; background: var(--flow-paper); border: 1px solid var(--flow-rule); border-radius: 4px; padding: 2px 4px; }
.fl-menu-body button { background: var(--flow-accent); color: var(--flow-accent-ink); }
.fl-menu-body button:hover { background: var(--flow-accent); }
.fl-status { padding: 0 8px; color: var(--flow-muted); }

/* Read-only pages */
.fl-pages { display: flex; flex-direction: column; align-items: center; gap: 1.5em; padding: 1.5em 0; }
.fl-page, .fl-sheet {
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
.fl-bubble { position: relative; isolation: isolate; font-family: system-ui, sans-serif; font-size: 0.8em; line-height: 1.3; }
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
  font-family: system-ui, sans-serif; color: var(--flow-muted); text-transform: none;
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

/* Flow view: same relationships, proportional to whatever width is available */
.fl-flow { max-width: 44em; margin: 0 auto; padding: 1.5em; background: var(--flow-paper); color: var(--flow-ink); min-height: 100%; line-height: 1.35; font-size: 16px; }
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
.fl-editor-host .fl-bubble-chip { margin: 0 0.25em; font-family: system-ui, sans-serif; font-size: 0.8em; line-height: 1.3; vertical-align: baseline; }
.fl-boneyard { color: var(--flow-muted); opacity: 0.75; text-decoration: line-through; }
.fl-page-gap {
  display: flex; align-items: center; justify-content: flex-end;
  height: 3em; margin: 2em calc(-1 * var(--fl-pad-right, 0em)) 2em -9em; padding: 0 1em;
  background: var(--flow-desk); color: var(--flow-muted);
  font-family: system-ui, sans-serif;
  box-shadow: inset 0 3px 4px -3px var(--flow-shadow), inset 0 -3px 4px -3px var(--flow-shadow);
  user-select: none;
}
.fl-flow .fl-page-gap { display: none; }
/* Without pages to separate them, breaks in flow view are drawn as a dashed line. */
.fl-break-rule, .fl-flow .fl-page-gap.fl-title-gap {
  display: block; height: 0; margin: 1em 0; padding: 0;
  background: none; box-shadow: none;
  border-top: 2px dashed var(--flow-rule);
}

@media print {
  :host { background: none; }
  .fl-ribbon { display: none; }
  .fl-scroll { overflow: visible; container-type: normal; }
  .fl-script { font-size: 12pt !important; }
  .fl-pages { display: block; padding: 0; }
  .fl-page { box-shadow: none; break-after: page; background: #fff; color: #000; }
  .fl-bubbles { display: none; }
}
`;
