// <flow-script>: Fountain screenplay editor and viewer.
//
// Storage-agnostic on purpose: it takes text in and emits text out, so the Google
// Drive plugin and the PWA can each supply their own persistence around it.

import { parse, layout, scriptTitle, DEFAULT_OPTIONS, formatDimensions, pageProfile, parseDimensions, resolvePaper, writeSetting } from '@flow/core';
import { STYLES } from './styles.js';
import { getTheme } from './themes.js';
import { renderReadonly } from './readonly.js';
import { createRibbon } from './ribbon.js';
import { createStatusbar, SCALE_MAX, SCALE_MIN, SCALE_STEP } from './statusbar.js';
import { createOutline } from './outline.js';
import { openExportDialog } from './export-dialog.js';
import { openSettingsDialog } from './settings-dialog.js';
import { createHighlightPainter, createHighlightTools, normalizeHighlights, openHighlightDialog } from './highlights.js';
import { placeOf, restorePlace } from './position.js';

let fontsRequested = false;

/** Loads the bundled Courier Prime. Runs automatically once any <flow-script> connects. */
export function loadFonts() {
  if (fontsRequested) return;
  fontsRequested = true;
  import('./fonts.js').then((m) => m.registerFonts()).catch(() => {});
}

export class FlowScript extends HTMLElement {
  static observedAttributes = ['readonly', 'view', 'read-view', 'workspace', 'theme', 'paper', 'scale'];

  #value = '';
  #valueSet = false;
  #options = { ...DEFAULT_OPTIONS };
  // The page size the export dialog last chose for PDFs, or null for the script's own.
  #exportPaper = null;
  // The size the settings dialog is trying out, shown until it saves or closes.
  #previewPaper = null;
  #shownPaper = '';
  #editor = null;
  #ribbon = null;
  #statusbar = null;
  #read = null;
  #outline = null;
  #exportActions = [];
  #highlights = [];
  #highlightTools = null;
  #painter = null;
  #barObserver = null;
  #scroll = null;
  #surface = null;
  #loading = null;
  #themeProps = [];
  #started = false;
  #pageFrame = 0;
  #pageTimer = 0;
  // Where the outline asked to go, kept until the tab it named shows.
  #jump = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.#scroll = document.createElement('div');
    this.#scroll.className = 'fl-scroll';
    shadow.append(style, this.#scroll);
    this.#painter = createHighlightPainter(shadow);
    // Chrome counts a scrollbar as part of a container's width, which would size a page to
    // fit a phone slightly too wide, so measure the room that's really there.
    new ResizeObserver(() => {
      this.style.setProperty('--fl-area-w', `${this.#scroll.clientWidth}px`);
      this.#trackPage();
    }).observe(this.#scroll);
    this.#listenForPinch();
    this.#scroll.addEventListener('scroll', () => this.#trackPage(), { passive: true });
  }

  connectedCallback() {
    if (this.#started) return;
    // Properties set before this element was defined sit on the instance and would
    // shadow the accessors, so reapply them through the class.
    for (const prop of ['value', 'readonly', 'view', 'readView', 'workspace', 'printOptions', 'exportActions', 'highlights']) {
      if (Object.hasOwn(this, prop)) {
        const pending = this[prop];
        delete this[prop];
        this[prop] = pending;
      }
    }
    this.#started = true;
    if (!this.#valueSet) {
      const script = this.querySelector('script[type="text/fountain"]');
      this.#value = parse(script ? dedent(script.textContent) : this.textContent.trim() ? dedent(this.textContent) : '').source;
    }
    loadFonts();
    this.applyTheme();
    this.#applyPaper();
    this.#applyScale();
    this.#render();
  }

  disconnectedCallback() {
    // Moving the element in the DOM reconnects immediately, so wait a tick first.
    queueMicrotask(() => {
      if (!this.isConnected) {
        if (this.#editor) this.#value = this.#editor.value;
        this.#editor?.destroy();
        this.#editor = null;
        this.#outline?.destroy();
        this.#outline = null;
        this.#painter.clear();
        this.#started = false;
        this.#valueSet = true;
      }
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#started) return;
    if (name === 'theme') this.applyTheme();
    if (name === 'scale') this.#applyScale();
    if (name === 'paper') {
      this.#options.paper = parseDimensions(newValue) ?? 'letter';
      this.#applyPaper();
    }
    if (name === 'read-view') {
      this.#syncBars();
      if (this.#editor && this.workspace === 'read') {
        const place = this.#placeIn('read');
        this.#showRead();
        this.#keepPlace(place);
      }
      return;
    }
    if (name === 'readonly') {
      this.#render();
    } else if (name === 'view' || name === 'workspace' || name === 'paper') {
      // A live editor only needs restyling, which keeps its undo history and cursor. Moving
      // between tabs or views keeps your place in the script.
      if (this.#editor) {
        const place = name === 'paper' ? null : this.#placeIn(name === 'workspace' ? workspaceOf(oldValue) : this.workspace);
        this.#restyleEditor();
        this.#keepPlace(place);
      } else if (this.#loading) this.#syncBars();
      else this.#render();
    }
  }

  // --- Public API ---

  /** The script as Fountain text. */
  get value() {
    return this.#editor ? this.#editor.value : this.#value;
  }

  set value(text) {
    this.#valueSet = true;
    this.#value = parse(text).source;
    if (this.#editor) {
      this.#editor.value = this.#value;
      this.#applyPaper();
      this.#showRead();
      this.#showOutline();
    } else if (this.#started) {
      this.#applyPaper();
      if (!this.#loading) this.#render();
    }
  }

  get readonly() {
    return this.hasAttribute('readonly');
  }

  set readonly(on) {
    this.toggleAttribute('readonly', !!on);
  }

  /**
   * How the Write tab shows the script: 'flow' (continuous, no pages, the default), 'page'
   * (standard script pages) or 'source' (the Fountain text itself, with nothing hidden or
   * formatted). Read-only shows pages unless this is set.
   */
  get view() {
    const view = this.getAttribute('view');
    return view === 'page' || view === 'source' ? view : 'flow';
  }

  set view(v) {
    this.setAttribute('view', v);
  }

  /**
   * How the Read tab shows the script: 'page' (the pages as they print, the default) or
   * 'flow' (continuous, with no pages).
   */
  get readView() {
    return this.getAttribute('read-view') === 'flow' ? 'flow' : 'page';
  }

  set readView(v) {
    this.setAttribute('read-view', v);
  }

  /**
   * 'write' (the script itself, the default), 'outline' (its acts, sequences, scenes and
   * transitions as cards and blocks, which edit the same text) or 'read' (the pages as they
   * print, with editing off). Outline and Read take the place of the view while they're showing.
   */
  get workspace() {
    const workspace = this.getAttribute('workspace');
    return workspace === 'outline' || workspace === 'read' ? workspace : 'write';
  }

  set workspace(w) {
    this.setAttribute('workspace', w);
  }

  /** How large the script is shown, as a percentage. */
  get scale() {
    const scale = Number(this.getAttribute('scale') ?? 100);
    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number.isFinite(scale) ? scale : 100));
  }

  set scale(percent) {
    this.setAttribute('scale', percent);
  }

  /**
   * The app's own export actions, shown before PDF: { label, title, icon, attrs, onClick }.
   * They appear as labeled buttons, then icons alone, then in a menu as space runs short.
   */
  get exportActions() {
    return this.#exportActions;
  }

  set exportActions(actions) {
    this.#exportActions = actions;
    this.#ribbon?.setExportActions(actions);
  }

  /**
   * What the Read tab highlights, in order: { terms, color, enabled }, where `terms` is one
   * search or several separated by commas, matched as whole words without regard to case, and
   * `color` is a hex color. Changes made in the Highlight Manager or the action center fire
   * `flow-highlights`, with the new list as `detail.highlights`, for an app to keep.
   */
  get highlights() {
    return this.#highlights.map((item) => ({ ...item }));
  }

  set highlights(list) {
    this.#highlights = normalizeHighlights(list);
    this.#highlightTools?.update(this.#highlights);
    this.#paintHighlights();
  }

  /** Section, scene and synopsis tree. Sections are never printed but always present here. */
  get outline() {
    return parse(this.value).outline;
  }

  /** Page count at the current print options. */
  get pageCount() {
    const { pages } = layout(parse(this.value), this.#options);
    return pages.filter((p) => p.kind === 'script').length;
  }

  /**
   * Print options: see DEFAULT_OPTIONS in @flow/core. Applies to page view and PDF. `paper`
   * is the size for a script whose page settings name none.
   */
  get printOptions() {
    return { ...this.#options };
  }

  set printOptions(options) {
    this.#options = { ...this.#options, ...options };
    if (options.paper) {
      const size = parseDimensions(options.paper) ?? 'letter';
      this.#options.paper = size;
      const attr = typeof size === 'string' ? size : formatDimensions(size);
      if (this.getAttribute('paper') !== attr) this.setAttribute('paper', attr);
      this.#applyPaper();
    }
    if (this.#editor) {
      this.#editor.relayout();
      this.#showRead();
    } else if (this.#started && !this.#loading) this.#render();
  }

  focus() {
    if (this.workspace === 'outline') this.#outline?.focus();
    else if (this.workspace === 'write') this.#editor?.focus();
  }

  scrollToLine(line) {
    if (this.#editor) {
      this.#editor.scrollToLine(line);
    } else {
      this.shadowRoot.querySelector(`[data-line="${Number(line)}"]`)?.scrollIntoView({ block: 'center' });
    }
  }

  /** Selects part of a source line and focuses the editor, without scrolling to it. */
  selectText(line, from, to) {
    this.#editor?.selectText(line, from, to);
  }

  /**
   * Builds the PDF. Resolves to { blob, bytes, pageCount, unsupported }, where
   * `unsupported` lists characters that couldn't be drawn and print as "?". The page size is
   * the script's own unless `paperOverride` names another.
   */
  async exportPdf(options = {}) {
    const [{ renderPdf }, { pdfFonts }] = await Promise.all([import('@flow/core/pdf'), import('./pdf-fonts.js')]);
    const result = await renderPdf(this.value, { ...this.#options, ...options, fonts: pdfFonts() });
    return { ...result, blob: new Blob([result.bytes], { type: 'application/pdf' }) };
  }

  /** Builds the PDF and saves it as a download. */
  async downloadPdf(options = {}) {
    const result = await this.exportPdf(options);
    const name = scriptTitle(parse(this.value), ' - ');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(result.blob);
    link.download = `${(options.filename ?? name ?? '').replace(/[\\/:*?"<>|]+/g, '') || 'screenplay'}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    return result;
  }

  /** Re-reads the `theme` attribute; called automatically when it changes. */
  applyTheme() {
    for (const prop of this.#themeProps) this.style.removeProperty(prop);
    this.#themeProps = [];
    const colors = getTheme(this.getAttribute('theme'));
    if (!colors) return;
    for (const [key, value] of Object.entries(colors)) {
      const prop = key.startsWith('--') ? key : `--flow-${key}`;
      this.style.setProperty(prop, value);
      this.#themeProps.push(prop);
    }
  }

  // --- Internals ---

  // The size pages show at: the script's own, or the default for a script that names none.
  #scriptPaper() {
    return resolvePaper(this.#editor ? this.#editor.parsed : parse(this.#value), this.#layoutOptions());
  }

  #layoutOptions() {
    return this.#previewPaper ? { ...this.#options, paperOverride: this.#previewPaper } : this.#options;
  }

  #preview(size) {
    this.#previewPaper = size;
    this.#applyPaper();
    if (!this.#editor) return;
    this.#editor.relayout();
    this.#showRead();
    this.#trackPageSoon();
  }

  #applyPaper() {
    const attr = parseDimensions(this.getAttribute('paper'));
    if (attr) this.#options.paper = attr;
    const paper = this.#scriptPaper();
    this.#shownPaper = JSON.stringify(paper);
    const profile = pageProfile(paper);
    this.style.setProperty('--fl-page-w', `${profile.widthIn * 6}em`);
    this.style.setProperty('--fl-page-h', `${profile.heightIn * 6}em`);
    this.style.setProperty('--fl-action-w', `${profile.actionWidth * 0.6}em`);
  }

  // Pinching drives the page scale, as the 100% − + pill does, instead of zooming the whole
  // app: the bars stay put and the script reflows at its new size. That's two fingers on a
  // touch screen, a pinch on a trackpad, or Ctrl with the mouse wheel, which is how browsers
  // report a trackpad pinch too.
  #listenForPinch() {
    const clamp = (raw) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(raw)));
    let pinch = null;
    let frame = 0;
    const begin = () => { pinch = { scale: this.scale, next: null }; };
    const move = (raw) => {
      pinch.next = clamp(raw);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pinch?.next != null) this.scale = pinch.next;
      });
    };
    const end = () => {
      if (!pinch) return;
      cancelAnimationFrame(frame);
      frame = 0;
      if (pinch.next !== null && pinch.next !== pinch.scale) this.#chooseScale(pinch.next);
      pinch = null;
    };

    const spread = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    let distance = 1;
    this.#scroll.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return end();
      begin();
      distance = spread(event.touches) || 1;
    }, { passive: true });
    // Not passive, so it can keep the browser from zooming or scrolling while it scales.
    this.#scroll.addEventListener('touchmove', (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      move(pinch.scale * (spread(event.touches) / distance));
    }, { passive: false });
    this.#scroll.addEventListener('touchend', (event) => { if (event.touches.length < 2) end(); });
    this.#scroll.addEventListener('touchcancel', end);

    // The wheel has no end of its own, so a pause settles the scale. Browsers report a
    // trackpad pinch as small deltas of -100·ln(scale), which this undoes to follow the
    // fingers exactly. A mouse notch is a large whole number, or lines or pages, and steps
    // 10% like the pill's buttons.
    let settle = 0;
    this.#scroll.addEventListener('wheel', (event) => {
      if (!event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      if (!pinch) begin();
      const from = pinch.next ?? pinch.scale;
      const notch = event.deltaMode !== 0 || (Math.abs(event.deltaY) >= 50 && Number.isInteger(event.deltaY));
      move(notch ? from - Math.sign(event.deltaY) * SCALE_STEP : from * Math.exp(-event.deltaY / 100));
      clearTimeout(settle);
      settle = setTimeout(end, 250);
    }, { passive: false });

    // Safari reports a pinch, on a trackpad or a touch screen, as gesture events.
    this.#scroll.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      if (!pinch) begin();
    }, { passive: false });
    this.#scroll.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      if (pinch && Number.isFinite(event.scale)) move(pinch.scale * event.scale);
    }, { passive: false });
    this.#scroll.addEventListener('gestureend', end);
  }

  // A scale the person picked, which the app may want to remember.
  #chooseScale(percent) {
    this.scale = percent;
    this.dispatchEvent(new CustomEvent('flow-scale', { detail: { scale: this.scale } }));
  }

  #applyScale() {
    const { scale } = this;
    this.style.setProperty('--fl-scale', scale / 100);
    this.#statusbar?.setScale(scale);
    this.#trackPage();
  }

  #render() {
    if (this.readonly) this.#renderReadonly();
    else this.#renderEditor();
  }

  #syncBars() {
    this.#ribbon?.setWorkspace(this.workspace);
    this.#statusbar?.setView(this.view, this.workspace, this.readView);
    this.#trackPageSoon();
  }

  #scriptHidden() {
    return this.workspace !== 'write';
  }

  #restyleEditor() {
    const wasHidden = this.#surface.hidden;
    this.#surface.className = this.#surfaceClass();
    this.#surface.hidden = this.#scriptHidden();
    this.#syncBars();
    this.#editor.relayout();
    this.#showRead();
    this.#showOutline();
    if (wasHidden && !this.#surface.hidden) this.#editor.focus({ scroll: false });
  }

  // The top of the room below the bars, where the line being read sits.
  #viewTop() {
    return this.#scroll.getBoundingClientRect().top + (this.#ribbon?.root.offsetHeight ?? 0);
  }

  // Each source line's elements in a tab, in order down the screen.
  #placeEntries(workspace) {
    if (workspace === 'read') {
      return [...(this.#read?.querySelectorAll('[data-line]') ?? [])].map((node) => ({ line: Number(node.dataset.line), node }));
    }
    if (workspace === 'outline') return this.#outline?.placeEntries() ?? [];
    return this.#editor?.lineNodes().map((node, line) => ({ line, node })) ?? [];
  }

  #placeIn(workspace) {
    const jump = this.#jump;
    this.#jump = null;
    return jump ?? placeOf(this.#scroll, this.#placeEntries(workspace), this.#viewTop());
  }

  // Shows the place in the current tab. Back in Write, a cursor left out of sight comes to it,
  // so typing carries on where you're looking rather than jumping away.
  #keepPlace(place) {
    if (!place) return;
    const restore = () => restorePlace(this.#scroll, this.#placeEntries(this.workspace), place, this.#viewTop(), { within: this.workspace === 'outline' });
    const line = restore();
    if (this.workspace === 'write' && line !== null) {
      const bottom = this.#scroll.getBoundingClientRect().bottom - (this.#statusbar?.root.offsetHeight ?? 0);
      if (place.jump || !this.#editor.cursorWithin(this.#viewTop(), bottom)) this.#editor.placeCursor(line);
    }
    // Text boxes and page breaks can settle a frame later.
    requestAnimationFrame(() => {
      if (this.#editor) restore();
      this.#trackPage();
    });
  }

  // Opens a line in Write or Read at the top of the page, as the outline's menu asks.
  #jumpTo(line, workspace) {
    if (workspace === this.workspace) return;
    this.#jump = { line, offset: 0, height: 0, jump: true };
    this.workspace = workspace;
    this.#jump = null;
    this.dispatchEvent(new CustomEvent('flow-workspace', { detail: { workspace } }));
  }

  // The Read tab's pages sit beside the hidden editor rather than replacing it, which is what
  // keeps undo history and the cursor when returning to write.
  #showRead() {
    const reading = this.workspace === 'read';
    if (reading && !this.#read) this.#scroll.scrollTop = 0;
    this.#read?.remove();
    this.#read = null;
    if (!reading) {
      this.#painter.clear();
      return;
    }
    this.#read = renderReadonly(this.#editor.value, { view: this.readView, options: this.#layoutOptions() });
    this.#read.classList.add('fl-read');
    this.#statusbar.root.before(this.#read);
    this.#paintHighlights();
    this.#trackPage();
  }

  // Highlights show only on what's being read: the Read tab, or the whole of a read-only script.
  #paintHighlights() {
    const root = this.#editor ? this.#read : this.#scroll.querySelector(':scope > .fl-script');
    if (root && (this.readonly || this.workspace === 'read')) this.#painter.paint(root, this.#highlights);
    else this.#painter.clear();
  }

  #changeHighlights(list) {
    this.highlights = list;
    this.dispatchEvent(new CustomEvent('flow-highlights', { detail: { highlights: this.highlights } }));
  }

  // Where each numbered page starts on screen, in order, in Read's pages or the Write tab's
  // Paged view. Neither counts the title page. While writing, a page starts below the gap
  // before it, and page 1 at the top of the sheet unless a title page comes first.
  #pageStarts() {
    if (this.workspace === 'read') {
      if (!this.#read?.classList.contains('fl-pages')) return [];
      return [...this.#read.querySelectorAll('.fl-page')]
        .filter((node) => node.dataset.page !== 'title')
        .map((node) => node.getBoundingClientRect().top);
    }
    if (this.workspace !== 'write' || this.view !== 'page' || !this.#surface) return [];
    const gaps = [...this.#surface.querySelectorAll('.fl-page-gap[data-page]')];
    const starts = gaps.map((gap) => gap.getBoundingClientRect().bottom);
    if (!gaps.some((gap) => gap.dataset.page === '1')) starts.unshift(this.#surface.getBoundingClientRect().top);
    return starts;
  }

  // The page under the top of the room between the bars is the one being read.
  #trackPage() {
    if (this.#pageFrame || !this.#statusbar) return;
    this.#pageFrame = requestAnimationFrame(() => {
      this.#pageFrame = 0;
      const starts = this.#pageStarts();
      if (!starts.length) return;
      const line = this.#scroll.getBoundingClientRect().top + (this.#ribbon?.root.offsetHeight ?? 0) + 24;
      let current = 1;
      starts.forEach((top, i) => { if (top <= line) current = i + 1; });
      this.#statusbar.setPage(current, starts.length);
    });
  }

  // The Write tab's page gaps follow a moment after the text or view settles.
  #trackPageSoon() {
    this.#trackPage();
    clearTimeout(this.#pageTimer);
    this.#pageTimer = setTimeout(() => this.#trackPage(), 300);
  }

  #goToPage(number) {
    const top = this.#pageStarts()[number - 1];
    if (top === undefined) return;
    const area = this.#scroll.getBoundingClientRect().top + (this.#ribbon?.root.offsetHeight ?? 0);
    this.#scroll.scrollTop += top - area - 12;
    this.#trackPage();
  }

  // The outline sits there too, and its edits go through the editor to share its history.
  #showOutline() {
    if (!this.#outline) return;
    const outlining = this.workspace === 'outline';
    if (outlining && this.#outline.root.hidden) this.#scroll.scrollTop = 0;
    this.#outline.root.hidden = !outlining;
    if (outlining) this.#outline.render(this.#editor.value);
  }

  #surfaceClass() {
    const shape = { flow: 'fl-flow', source: 'fl-source' }[this.view] ?? 'fl-sheet';
    return `fl-script fl-editor-host ${shape}`;
  }

  #renderReadonly() {
    this.#loading = null;
    if (this.#editor) {
      this.#value = this.#editor.value;
      this.#editor.destroy();
      this.#editor = null;
    }
    this.#outline?.destroy();
    this.#outline = null;
    this.#destroyBars();
    this.#read = null;
    // Read-only is for reading, so like the Read tab it shows pages unless asked otherwise.
    const view = this.hasAttribute('view') ? this.view : 'page';
    this.#scroll.replaceChildren(renderReadonly(this.#value, { view, options: this.#options }));
    this.#paintHighlights();
    this.dispatchEvent(new CustomEvent('flow-ready'));
  }

  async #renderEditor() {
    if (this.#editor) {
      this.#value = this.#editor.value;
      this.#editor.destroy();
      this.#editor = null;
    }
    this.#outline?.destroy();
    this.#outline = null;
    // The bars don't need the editor code, so they appear without waiting for it.
    this.#createBars();
    const token = (this.#loading = {});
    const { FlowEditor } = await import('./editor.js');
    if (this.#loading !== token || this.readonly) return;
    this.#loading = null;

    this.#surface = document.createElement('div');
    this.#surface.className = this.#surfaceClass();
    this.#surface.hidden = this.#scriptHidden();
    this.#outline = createOutline({
      edit: (lines, options) => this.#editor.commitFromOutline(lines, options),
      undo: () => this.#editor.undo({ focus: false }),
      redo: () => this.#editor.redo({ focus: false }),
      jump: (line, workspace) => this.#jumpTo(line, workspace),
    });
    this.#ribbon.setActions('outline', { label: 'Outline', pills: this.#outline.tools });
    this.#syncBars();
    this.#scroll.replaceChildren(this.#ribbon.root, this.#surface, this.#outline.root, this.#statusbar.root);
    this.#read = null;
    this.#editor = new FlowEditor(this.#surface, {
      value: this.#value,
      getLayoutOptions: () => this.#layoutOptions(),
      showSource: () => this.view === 'source',
      onChange: (value, outline) => {
        this.#value = value;
        // Page settings are part of the text, so an edit or an undo can change the page size.
        if (JSON.stringify(this.#scriptPaper()) !== this.#shownPaper) {
          this.#applyPaper();
          this.#showRead();
        }
        this.#trackPageSoon();
        if (this.workspace === 'outline') this.#outline?.render(value);
        this.dispatchEvent(new CustomEvent('flow-change', { detail: { value, outline } }));
      },
      onState: (state) => {
        this.#ribbon?.update(state);
        this.#statusbar?.update(state);
        this.dispatchEvent(new CustomEvent('flow-selection', { detail: state }));
      },
    });
    this.#applyInsets();
    this.#showRead();
    this.#showOutline();
    this.dispatchEvent(new CustomEvent('flow-ready'));
  }

  #createBars() {
    if (this.#ribbon) return;
    this.#ribbon = this.#buildRibbon();
    this.#statusbar = this.#buildStatusbar();
    this.#scroll.classList.add('fl-has-bars');
    this.#scroll.prepend(this.#ribbon.root);
    this.#scroll.append(this.#statusbar.root);
    // The pills wrap to more or fewer lines, and what they cover depends on their height.
    this.#barObserver = new ResizeObserver(() => this.#applyInsets());
    this.#barObserver.observe(this.#ribbon.root);
    this.#barObserver.observe(this.#statusbar.root);
    this.#ribbon.setExportActions(this.#exportActions);
    this.#highlightTools = createHighlightTools({
      open: () => openHighlightDialog(this.shadowRoot, {
        highlights: this.#highlights,
        onSave: (list) => this.#changeHighlights(list),
        onClose: () => this.focus(),
      }),
      toggle: (index) => this.#changeHighlights(this.#highlights.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item))),
    });
    this.#highlightTools.update(this.#highlights);
    this.#ribbon.setActions('read', { label: 'Reading', pills: [this.#highlightTools.root] });
    this.#syncBars();
    this.#statusbar.setScale(this.scale);
  }

  #applyInsets() {
    if (!this.#ribbon) return;
    const top = this.#ribbon.root.offsetHeight;
    const bottom = this.#statusbar.root.offsetHeight;
    this.style.setProperty('--fl-inset-top', `${top}px`);
    this.style.setProperty('--fl-inset-bottom', `${bottom}px`);
    this.#editor?.setInsets(top, bottom);
  }

  #destroyBars() {
    this.#barObserver?.disconnect();
    this.#barObserver = null;
    this.#scroll.classList.remove('fl-has-bars');
    this.style.removeProperty('--fl-inset-top');
    this.style.removeProperty('--fl-inset-bottom');
    this.#ribbon?.destroy();
    this.#statusbar?.destroy();
    this.#ribbon = null;
    this.#statusbar = null;
    this.#highlightTools = null;
  }

  #buildStatusbar() {
    return createStatusbar({
      undo: () => this.#editor?.undo({ focus: this.workspace === 'write' }),
      redo: () => this.#editor?.redo({ focus: this.workspace === 'write' }),
      setView: (view) => { this.view = view; },
      setReadView: (view) => { this.readView = view; },
      goToPage: (number) => this.#goToPage(number),
      setScale: (percent) => this.#chooseScale(percent),
    });
  }

  #buildRibbon() {
    const edit = (fn) => (...args) => this.#editor && fn(this.#editor, ...args);
    return createRibbon({
      emphasis: edit((e, style) => e.emphasis(style)),
      setLineType: edit((e, type) => e.setLineType(type)),
      dual: edit((e) => e.dual()),
      boneyard: edit((e) => e.boneyard()),
      pageBreak: edit((e) => e.pageBreak()),
      openExport: () => openExportDialog(this.shadowRoot, {
        getOptions: () => this.#options,
        setOption: (key, value) => { this.printOptions = { [key]: value }; },
        getScriptPaper: () => this.#scriptPaper(),
        getExportPaper: () => this.#exportPaper,
        setExportPaper: (size) => { this.#exportPaper = size; },
        exportPdf: () => this.#exportFromDialog(),
        onClose: () => this.focus(),
      }),
      openSettings: () => openSettingsDialog(this.shadowRoot, {
        getDimensions: () => this.#scriptPaper(),
        setDimensions: (size) => this.#setDimensions(size),
        preview: (size) => this.#preview(size),
        onClose: () => this.focus(),
      }),
    });
  }

  // Writes the page size into the script's settings. A script that has none and keeps the size
  // it already shows at stays as it is.
  #setDimensions(size) {
    this.#preview(null);
    if (!this.#editor) return;
    const { parsed } = this.#editor;
    if (parsed.settings.dimensions === undefined && JSON.stringify(size) === JSON.stringify(this.#scriptPaper())) return;
    this.#editor.commitFromOutline(writeSetting(parsed, 'Dimensions', formatDimensions(size)));
  }

  async #exportFromDialog() {
    const setStatus = (text) => this.#statusbar?.setStatus(text);
    setStatus('Building PDF…');
    try {
      const { pageCount, unsupported } = await this.downloadPdf(this.#exportPaper ? { paperOverride: this.#exportPaper } : {});
      setStatus(unsupported.length
        ? `Exported, but "${unsupported.slice(0, 8).join('')}" can't be drawn and show as "?"`
        : `Exported ${pageCount} page${pageCount === 1 ? '' : 's'}`);
    } catch (err) {
      setStatus(`PDF export failed: ${err.message}`);
    }
  }
}

const workspaceOf = (value) => (value === 'outline' || value === 'read' ? value : 'write');

// Inline scripts in HTML are usually indented with the markup; indentation is
// meaningful to action lines, so strip only what every line shares.
function dedent(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length);
  const shared = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(shared)).join('\n');
}
