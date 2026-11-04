// <flow-script>: Fountain screenplay editor and viewer.
//
// Storage-agnostic on purpose: it takes text in and emits text out, so the Google
// Drive plugin and the PWA can each supply their own persistence around it.

import { parse, layout, DEFAULT_OPTIONS, PROFILES } from '@flow/core';
import { STYLES } from './styles.js';
import { getTheme } from './themes.js';
import { renderReadonly } from './readonly.js';
import { createRibbon } from './ribbon.js';
import { createStatusbar, SCALE_MAX, SCALE_MIN } from './statusbar.js';
import { createOutline } from './outline.js';
import { openExportDialog } from './export-dialog.js';

let fontsRequested = false;

/** Loads the bundled Courier Prime. Runs automatically once any <flow-script> connects. */
export function loadFonts() {
  if (fontsRequested) return;
  fontsRequested = true;
  import('./fonts.js').then((m) => m.registerFonts()).catch(() => {});
}

export class FlowScript extends HTMLElement {
  static observedAttributes = ['readonly', 'view', 'workspace', 'theme', 'paper', 'scale'];

  #value = '';
  #valueSet = false;
  #options = { ...DEFAULT_OPTIONS };
  #editor = null;
  #ribbon = null;
  #statusbar = null;
  #preview = null;
  #outline = null;
  #exportActions = [];
  #barObserver = null;
  #scroll = null;
  #surface = null;
  #loading = null;
  #themeProps = [];
  #started = false;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.#scroll = document.createElement('div');
    this.#scroll.className = 'fl-scroll';
    shadow.append(style, this.#scroll);
    // Chrome counts a scrollbar as part of a container's width, which would size a page to
    // fit a phone slightly too wide, so measure the room that's really there.
    new ResizeObserver(() => {
      this.style.setProperty('--fl-area-w', `${this.#scroll.clientWidth}px`);
    }).observe(this.#scroll);
  }

  connectedCallback() {
    if (this.#started) return;
    // Properties set before this element was defined sit on the instance and would
    // shadow the accessors, so reapply them through the class.
    for (const prop of ['value', 'readonly', 'view', 'workspace', 'printOptions', 'exportActions']) {
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
      this.#options.paper = PROFILES[newValue] ? newValue : 'letter';
      this.#applyPaper();
    }
    if (name === 'readonly') {
      this.#render();
    } else if (name === 'view' || name === 'workspace' || name === 'paper') {
      // A live editor only needs restyling, which keeps its undo history and cursor.
      if (this.#editor) this.#restyleEditor();
      else if (this.#loading) this.#syncBars();
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
      this.#showPreview();
      this.#showOutline();
    } else if (this.#started && !this.#loading) this.#render();
  }

  get readonly() {
    return this.hasAttribute('readonly');
  }

  set readonly(on) {
    this.toggleAttribute('readonly', !!on);
  }

  /**
   * 'page' (standard script pages, the default), 'flow' (continuous, no pages),
   * 'preview' (the pages as they print, with editing off) or 'source' (the Fountain
   * text itself, with nothing hidden or formatted).
   */
  get view() {
    const view = this.getAttribute('view');
    return view === 'flow' || view === 'preview' || view === 'source' ? view : 'page';
  }

  set view(v) {
    this.setAttribute('view', v);
  }

  /**
   * 'write' (the script itself, the default) or 'outline' (its acts, sequences, scenes and
   * transitions as cards and blocks, which edit the same text). Takes the place of the view while it's showing.
   */
  get workspace() {
    return this.getAttribute('workspace') === 'outline' ? 'outline' : 'write';
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

  /** Section, scene and synopsis tree. Sections are never printed but always present here. */
  get outline() {
    return parse(this.value).outline;
  }

  /** Page count at the current print options. */
  get pageCount() {
    const { pages } = layout(parse(this.value), this.#options);
    return pages.filter((p) => p.kind === 'script').length;
  }

  /** Print options: see DEFAULT_OPTIONS in @flow/core. Applies to page view and PDF. */
  get printOptions() {
    return { ...this.#options };
  }

  set printOptions(options) {
    this.#options = { ...this.#options, ...options };
    if (options.paper) {
      if (this.getAttribute('paper') !== options.paper) this.setAttribute('paper', options.paper);
      this.#applyPaper();
    }
    if (this.#editor) {
      this.#editor.relayout();
      this.#showPreview();
    } else if (this.#started && !this.#loading) this.#render();
  }

  focus() {
    if (this.workspace === 'outline') this.#outline?.focus();
    else this.#editor?.focus();
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
   * `unsupported` lists characters that couldn't be drawn and print as "?".
   */
  async exportPdf(options = {}) {
    const [{ renderPdf }, { pdfFonts }] = await Promise.all([import('@flow/core/pdf'), import('./pdf-fonts.js')]);
    const result = await renderPdf(this.value, { ...this.#options, ...options, fonts: pdfFonts() });
    return { ...result, blob: new Blob([result.bytes], { type: 'application/pdf' }) };
  }

  /** Builds the PDF and saves it as a download. */
  async downloadPdf(options = {}) {
    const result = await this.exportPdf(options);
    const title = parse(this.value).titlePage.find((e) => e.key === 'title');
    const name = title ? parse(this.value).lines[title.lines[0]].text.trim() : '';
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

  #applyPaper() {
    const attr = this.getAttribute('paper');
    if (PROFILES[attr]) this.#options.paper = attr;
    const profile = PROFILES[this.#options.paper] ?? PROFILES.letter;
    this.style.setProperty('--fl-page-w', `${profile.widthIn * 6}em`);
    this.style.setProperty('--fl-page-h', `${profile.heightIn * 6}em`);
    this.style.setProperty('--fl-action-w', `${profile.actionWidth * 0.6}em`);
  }

  #applyScale() {
    const { scale } = this;
    this.style.setProperty('--fl-scale', scale / 100);
    this.#statusbar?.setScale(scale);
  }

  #render() {
    if (this.readonly) this.#renderReadonly();
    else this.#renderEditor();
  }

  #syncBars() {
    const outlining = this.workspace === 'outline';
    this.#ribbon?.setView(this.view, outlining);
    this.#statusbar?.setView(this.view, outlining);
  }

  #scriptHidden() {
    return this.view === 'preview' || this.workspace === 'outline';
  }

  #restyleEditor() {
    const wasHidden = this.#surface.hidden;
    this.#surface.className = this.#surfaceClass();
    this.#surface.hidden = this.#scriptHidden();
    this.#syncBars();
    this.#editor.relayout();
    this.#showPreview();
    this.#showOutline();
    if (wasHidden && !this.#surface.hidden) this.#editor.focus();
  }

  // Preview sits beside the hidden editor rather than replacing it, which is what
  // keeps undo history and the cursor when returning to edit.
  #showPreview() {
    this.#preview?.remove();
    this.#preview = null;
    if (this.view !== 'preview' || this.workspace === 'outline') return;
    this.#preview = renderReadonly(this.#editor.value, { view: 'page', options: this.#options });
    this.#statusbar.root.before(this.#preview);
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
    this.#preview = null;
    this.#scroll.replaceChildren(renderReadonly(this.#value, { view: this.view, options: this.#options }));
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
    });
    this.#scroll.replaceChildren(this.#ribbon.root, this.#surface, this.#outline.root, this.#statusbar.root);
    this.#preview = null;
    this.#editor = new FlowEditor(this.#surface, {
      value: this.#value,
      getLayoutOptions: () => this.#options,
      showSource: () => this.view === 'source',
      onChange: (value, outline) => {
        this.#value = value;
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
    this.#showPreview();
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
  }

  #buildStatusbar() {
    return createStatusbar({
      undo: () => this.#editor?.undo({ focus: this.workspace !== 'outline' }),
      redo: () => this.#editor?.redo({ focus: this.workspace !== 'outline' }),
      setView: (view) => { this.view = view; },
      setScale: (percent) => {
        this.scale = percent;
        this.dispatchEvent(new CustomEvent('flow-scale', { detail: { scale: this.scale } }));
      },
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
        exportPdf: () => this.#exportFromDialog(),
        onClose: () => this.focus(),
      }),
    });
  }

  async #exportFromDialog() {
    const setStatus = (text) => this.#statusbar?.setStatus(text);
    setStatus('Building PDF…');
    try {
      const { pageCount, unsupported } = await this.downloadPdf();
      setStatus(unsupported.length
        ? `Exported, but "${unsupported.slice(0, 8).join('')}" can't be drawn and show as "?"`
        : `Exported ${pageCount} page${pageCount === 1 ? '' : 's'}`);
    } catch (err) {
      setStatus(`PDF export failed: ${err.message}`);
    }
  }
}

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
