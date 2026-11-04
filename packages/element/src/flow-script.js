// <flow-script>: Fountain screenplay editor and viewer.
//
// Storage-agnostic on purpose: it takes text in and emits text out, so the Google
// Drive plugin and the PWA can each supply their own persistence around it.

import { parse, layout, DEFAULT_OPTIONS, PROFILES } from '@flow/core';
import { STYLES } from './styles.js';
import { getTheme } from './themes.js';
import { renderReadonly } from './readonly.js';
import { createRibbon } from './ribbon.js';

let fontsRequested = false;

export class FlowScript extends HTMLElement {
  static observedAttributes = ['readonly', 'view', 'theme', 'paper'];

  #value = '';
  #valueSet = false;
  #options = { ...DEFAULT_OPTIONS };
  #editor = null;
  #ribbon = null;
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
  }

  connectedCallback() {
    if (this.#started) return;
    // Properties set before this element was defined sit on the instance and would
    // shadow the accessors, so reapply them through the class.
    for (const prop of ['value', 'readonly', 'view', 'printOptions']) {
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
    if (!fontsRequested) {
      fontsRequested = true;
      import('./fonts.js').then((m) => m.registerFonts()).catch(() => {});
    }
    this.applyTheme();
    this.#applyPaper();
    this.#render();
  }

  disconnectedCallback() {
    // Moving the element in the DOM reconnects immediately, so wait a tick first.
    queueMicrotask(() => {
      if (!this.isConnected) {
        if (this.#editor) this.#value = this.#editor.value;
        this.#editor?.destroy();
        this.#editor = null;
        this.#started = false;
        this.#valueSet = true;
      }
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#started) return;
    if (name === 'theme') this.applyTheme();
    if (name === 'paper') {
      this.#options.paper = PROFILES[newValue] ? newValue : 'letter';
      this.#applyPaper();
    }
    if (name === 'readonly') {
      this.#render();
    } else if (name === 'view' || name === 'paper') {
      // A live editor only needs restyling, which keeps its undo history and cursor.
      if (this.#editor) this.#restyleEditor();
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
    if (this.#editor) this.#editor.value = this.#value;
    else if (this.#started && !this.#loading) this.#render();
  }

  get readonly() {
    return this.hasAttribute('readonly');
  }

  set readonly(on) {
    this.toggleAttribute('readonly', !!on);
  }

  /** 'page' (standard script pages, the default) or 'flow' (continuous, no pages). */
  get view() {
    return this.getAttribute('view') === 'flow' ? 'flow' : 'page';
  }

  set view(v) {
    this.setAttribute('view', v);
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
    if (this.#editor) this.#editor.relayout();
    else if (this.#started && !this.#loading) this.#render();
  }

  focus() {
    this.#editor?.focus();
  }

  scrollToLine(line) {
    if (this.#editor) {
      this.#editor.scrollToLine(line);
    } else {
      this.shadowRoot.querySelector(`[data-line="${Number(line)}"]`)?.scrollIntoView({ block: 'center' });
    }
  }

  /**
   * Builds the PDF. Resolves to { blob, bytes, pageCount, unsupported }, where
   * `unsupported` lists characters the built-in Courier couldn't draw.
   */
  async exportPdf(options = {}) {
    const { renderPdf } = await import('@flow/core/pdf');
    const result = await renderPdf(this.value, { ...this.#options, ...options });
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

  #render() {
    if (this.readonly) this.#renderReadonly();
    else this.#renderEditor();
  }

  #restyleEditor() {
    this.#surface.className = this.#surfaceClass();
    this.#ribbon.setView(this.view);
    this.#editor.relayout();
  }

  #surfaceClass() {
    return `fl-script fl-editor-host ${this.view === 'flow' ? 'fl-flow' : 'fl-sheet'}`;
  }

  #renderReadonly() {
    this.#loading = null;
    if (this.#editor) {
      this.#value = this.#editor.value;
      this.#editor.destroy();
      this.#editor = null;
    }
    this.#ribbon?.destroy();
    this.#ribbon = null;
    this.#scroll.replaceChildren(renderReadonly(this.#value, { view: this.view, options: this.#options }));
    this.dispatchEvent(new CustomEvent('flow-ready'));
  }

  async #renderEditor() {
    if (this.#editor) {
      this.#value = this.#editor.value;
      this.#editor.destroy();
      this.#editor = null;
    }
    const token = (this.#loading = {});
    const { FlowEditor } = await import('./editor.js');
    if (this.#loading !== token || this.readonly) return;
    this.#loading = null;

    if (!this.#ribbon) {
      this.#ribbon = this.#buildRibbon();
      this.shadowRoot.insertBefore(this.#ribbon.root, this.#scroll);
    }
    this.#ribbon.setView(this.view);
    this.#surface = document.createElement('div');
    this.#surface.className = this.#surfaceClass();
    this.#scroll.replaceChildren(this.#surface);
    this.#editor = new FlowEditor(this.#surface, {
      value: this.#value,
      getLayoutOptions: () => this.#options,
      onChange: (value, outline) => {
        this.#value = value;
        this.dispatchEvent(new CustomEvent('flow-change', { detail: { value, outline } }));
      },
      onState: (state) => {
        this.#ribbon?.update(state);
        this.dispatchEvent(new CustomEvent('flow-selection', { detail: state }));
      },
    });
    this.dispatchEvent(new CustomEvent('flow-ready'));
  }

  #buildRibbon() {
    const edit = (fn) => (...args) => this.#editor && fn(this.#editor, ...args);
    return createRibbon({
      emphasis: edit((e, style) => e.emphasis(style)),
      setLineType: edit((e, type) => e.setLineType(type)),
      dual: edit((e) => e.dual()),
      boneyard: edit((e) => e.boneyard()),
      pageBreak: edit((e) => e.pageBreak()),
      undo: edit((e) => e.undo()),
      redo: edit((e) => e.redo()),
      toggleView: () => { this.view = this.view === 'flow' ? 'page' : 'flow'; },
      getOptions: () => this.#options,
      setOption: (key, value) => { this.printOptions = { [key]: value }; },
      exportPdf: async () => {
        this.#ribbon.setStatus('Building PDF…');
        try {
          const { pageCount, unsupported } = await this.downloadPdf();
          this.#ribbon.setStatus(unsupported.length
            ? `Exported, but "${unsupported.slice(0, 8).join('')}" can't be drawn in Courier and show as "?"`
            : `Exported ${pageCount} page${pageCount === 1 ? '' : 's'}`);
        } catch (err) {
          this.#ribbon.setStatus(`PDF export failed: ${err.message}`);
        }
      },
    });
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
