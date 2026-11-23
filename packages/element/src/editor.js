// The editing surface, loaded on demand. Each editor line holds raw Fountain text;
// nothing is stored as rich text. All formatting is decoration derived from the
// parser, so the file on disk is exactly what the writer typed.

import { Editor, Node, Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Fragment, Slice } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { parse, layout, titlePositions, TITLE_INDENT, continueTitleField, joinTitleValue, applyLineType, dualAt, insertPageBreak, toggleBoneyard, toggleDual, toggleEmphasis, emphasisAt, lineTypeKey } from '@flow/core';

const NOTE_ICON = '\u{1F4AC}︎';

const Line = Node.create({
  name: 'line',
  group: 'block',
  content: 'text*',
  marks: '',
  whitespace: 'pre', // keep spaces exactly; don't set `code`, it makes Enter insert "\n"
  defining: true,
  parseHTML: () => [{ tag: 'div', preserveWhitespace: 'full' }, { tag: 'p', preserveWhitespace: 'full' }],
  renderHTML: () => ['div', { class: 'fl-line' }, 0],
});

const docLines = (doc) => {
  const lines = [];
  doc.forEach((node) => lines.push(node.textContent));
  return lines;
};

const lineToJson = (text) => (text ? { type: 'line', content: [{ type: 'text', text }] } : { type: 'line' });
const textToJson = (text) => ({ type: 'doc', content: parse(text).source.split('\n').map(lineToJson) });

// Replaces the document between two positions inside lines with text, which may hold line breaks.
function replaceText(tr, from, to, text) {
  if (text) {
    const nodes = text.split('\n').map((t) => tr.doc.type.schema.nodeFromJSON(lineToJson(t)));
    tr.replace(from, to, new Slice(Fragment.from(nodes), 1, 1));
  } else if (from !== to) tr.delete(from, to);
  return tr;
}

// The position of an offset into the script's text, where each line ends in one line break.
function offsetPos(doc, offset) {
  let pos = 0;
  let left = Math.max(0, offset);
  for (let i = 0; i < doc.childCount; i++) {
    const size = doc.child(i).content.size;
    if (left <= size || i === doc.childCount - 1) return pos + 1 + Math.min(left, size);
    left -= size + 1;
    pos += doc.child(i).nodeSize;
  }
  return 1;
}

function lineClasses(line) {
  const classes = [`fl-${line.type}`];
  if (line.forced) classes.push('fl-forced');
  if (line.type === 'section') classes.push(`fl-section-${Math.min(line.level, 3)}`);
  if (line.inDialogue) classes.push('fl-in-dialogue');
  if (line.type === 'title') classes.push(`fl-title-${line.titleKey.replace(/\s+/g, '-')}`);
  return classes.join(' ');
}

function chip(comment, onOpen) {
  const dom = document.createElement('span');
  dom.className = 'fl-bubble-chip';
  dom.setAttribute('role', 'button');
  dom.setAttribute('aria-label', `Note: ${comment.text}`);
  dom.title = comment.text;
  const icon = document.createElement('span');
  icon.textContent = NOTE_ICON;
  const preview = document.createElement('span');
  preview.className = 'fl-bubble-preview';
  preview.textContent = comment.text.split('\n')[0];
  dom.append(icon, preview);
  dom.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen();
  });
  return dom;
}

function pageGap(number, continued) {
  const dom = document.createElement('div');
  // Page 1 only gets a break when a title page sits before it.
  dom.className = number === 1 ? 'fl-page-gap fl-title-gap' : 'fl-page-gap';
  dom.setAttribute('aria-hidden', 'true');
  dom.dataset.page = number;
  const label = document.createElement('span');
  label.textContent = continued ? `(CONTINUED)  ${number}.` : `${number}.`;
  dom.append(label);
  return dom;
}

// With no title page, nothing separates page 1 from the top of the sheet. It prints
// unnumbered, as is standard, but while writing every page shows its number.
function firstPageNumber() {
  const dom = document.createElement('span');
  dom.className = 'fl-page-one';
  dom.setAttribute('aria-hidden', 'true');
  dom.textContent = '1.';
  return dom;
}

const scriptKey = new PluginKey('flowScript');
const activeKey = new PluginKey('flowActive');
const gapsKey = new PluginKey('flowGaps');
const GAP_DELAY_MS = 200;

// Later lines of a note fold into its bubble. A boneyard has no bubble, so all of it stays visible.
const isCommentTail = (line, index) => line.commentOnly && line.comments.every((c) => c.comment.type === 'note' && c.comment.lineStart !== index);

// In page view, the title page is laid out like print. Its lines are placed by row, and
// the blank line that separates them from the script takes up no room.
function coverInfo(parsed, options) {
  const positions = titlePositions(parsed, options);
  const hidden = hiddenLines(parsed);
  if (!positions.size) return { positions, hidden, last: -1, separator: -1 };
  const last = Math.max(...parsed.titlePage.flatMap((entry) => entry.lines));
  return { positions, hidden, last, separator: parsed.lines[last + 1]?.type === 'blank' ? last + 1 : -1 };
}

// The script's settings boneyard is out of sight but in Fountain view, where the file shows as
// it is, as long as it has its lines to itself. Opening the script, it's followed by a blank
// line that's hidden too, unless that's the last line and so the only place left to type.
function hiddenLines(parsed) {
  const block = parsed.settingsBlock;
  if (!block?.whole) return new Set();
  const { lineStart, lineEnd } = block.comment;
  const hidden = new Set(Array.from({ length: lineEnd - lineStart + 1 }, (_, i) => lineStart + i));
  const after = lineEnd + 1;
  const opens = parsed.lines.slice(0, lineStart).every((l) => l.type === 'blank');
  if (opens && parsed.lines[after]?.type === 'blank' && after < parsed.lines.length - 1) hidden.add(after);
  return hidden;
}

// Everything a line's decorations depend on, so unchanged lines can be left alone.
function lineSignature(line, index, cover) {
  const openingComments = line.comments.filter((c) => c.comment.lineStart === index).map((c) => c.comment.text);
  return [line.raw, line.masked, lineClasses(line), isCommentTail(line, index), cover.positions.get(index), cover.separator === index, cover.hidden.has(index), ...openingComments].join('\u0001');
}

function openCommentAt(view, pos) {
  const { doc } = view.state;
  // Just past the opening [[, ready to edit.
  view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, Math.min(pos + 2, doc.content.size - 1))));
  view.focus();
}

function lineDecorations(node, pos, line, index, cover) {
  const decorations = [];
  const at = (offset) => pos + 1 + offset;
  const row = cover.positions.get(index);
  const classes = [lineClasses(line), isCommentTail(line, index) && 'fl-comment-hidden', row !== undefined && 'fl-title-placed', cover.separator === index && 'fl-title-separator', cover.hidden.has(index) && 'fl-setting'];
  decorations.push(Decoration.node(pos, pos + node.nodeSize, {
    class: classes.filter(Boolean).join(' '),
    ...(row !== undefined ? { style: `--fl-title-y: ${row}` } : {}),
  }));
  const indented = line.type === 'title' && TITLE_INDENT.test(line.raw);
  for (const [a, b] of line.markers) if (b > a) decorations.push(Decoration.inline(at(a), at(b), { class: indented && a === 0 ? 'fl-marker fl-indent' : 'fl-marker' }));
  if (line.sceneNumberRange) decorations.push(Decoration.inline(at(line.sceneNumberRange[0]), at(line.sceneNumberRange[1]), { class: 'fl-scene-number' }));
  for (const run of line.runs) {
    const classes = [run.bold && 'fl-b', run.italic && 'fl-i', run.underline && 'fl-u'].filter(Boolean).join(' ');
    if (classes) decorations.push(Decoration.inline(at(run.start), at(run.end), { class: classes }));
  }
  for (const { comment, start, end } of line.comments) {
    if (comment.type === 'boneyard') {
      if (end > start) decorations.push(Decoration.inline(at(start), at(end), { class: 'fl-boneyard' }));
      if (comment.lineStart === index) decorations.push(Decoration.inline(at(start), at(start + 2), { class: 'fl-marker' }));
      if (comment.lineEnd === index) decorations.push(Decoration.inline(at(end - 2), at(end), { class: 'fl-marker' }));
      continue;
    }
    if (end > start) decorations.push(Decoration.inline(at(start), at(end), { class: 'fl-comment-src' }));
    if (comment.lineStart === index) {
      decorations.push(Decoration.widget(at(start), (view, getPos) => chip(comment, () => openCommentAt(view, getPos())), {
        side: -1,
        ignoreSelection: true,
        key: `c-${comment.type}-${comment.text.slice(0, 80)}`,
      }));
    }
  }
  return decorations;
}

function computeScript(doc, options) {
  const parsed = parse(docLines(doc).join('\n'));
  const cover = coverInfo(parsed, options);
  const signatures = parsed.lines.map((line, i) => lineSignature(line, i, cover));
  const decorations = [];
  let index = 0;
  doc.forEach((node, pos) => {
    decorations.push(...lineDecorations(node, pos, parsed.lines[index], index, cover));
    index++;
  });
  return { parsed, hidden: cover.hidden, signatures, decorations: DecorationSet.create(doc, decorations) };
}

// The lines a transaction touched, as an index range in the new document.
function touchedLines(tr) {
  let min = Infinity;
  let max = -Infinity;
  tr.mapping.maps.forEach((map, i) => {
    const later = tr.mapping.slice(i + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      min = Math.min(min, later.map(newStart, -1));
      max = Math.max(max, later.map(newEnd, 1));
    });
  });
  if (min === Infinity) return null;
  const { doc } = tr;
  const clamp = (p) => Math.max(0, Math.min(p, doc.content.size));
  const lastLine = doc.childCount - 1;
  return {
    first: Math.max(0, Math.min(doc.resolve(clamp(min)).index(0), lastLine) - 1),
    last: Math.min(lastLine, doc.resolve(clamp(max)).index(0) + 1),
  };
}

// Reparses, but only rebuilds decorations for touched lines and for lines elsewhere
// whose meaning changed (typing "[[" can reclassify a line far below, for example).
function updateScript(tr, prev, options) {
  const touched = touchedLines(tr);
  if (!touched) return computeScript(tr.doc, options);
  const parsed = parse(docLines(tr.doc).join('\n'));
  const cover = coverInfo(parsed, options);
  const signatures = parsed.lines.map((line, i) => lineSignature(line, i, cover));
  const delta = signatures.length - prev.signatures.length;

  let decorations = prev.decorations.map(tr.mapping, tr.doc);
  const add = [];
  const remove = [];
  let index = 0;
  tr.doc.forEach((node, pos) => {
    const i = index++;
    const before = i < touched.first ? prev.signatures[i] : i > touched.last ? prev.signatures[i - delta] : null;
    if (before === signatures[i]) return;
    const end = pos + node.nodeSize;
    for (const d of decorations.find(pos, end)) if (d.from >= pos && d.to <= end) remove.push(d);
    add.push(...lineDecorations(node, pos, parsed.lines[i], i, cover));
  });
  if (remove.length) decorations = decorations.remove(remove);
  if (add.length) decorations = decorations.add(tr.doc, add);
  return { parsed, hidden: cover.hidden, signatures, decorations };
}

function selectedLines(state) {
  const { from, to } = state.selection;
  // A select-all ends after the final line, which resolves one index past it.
  const lastLine = state.doc.childCount - 1;
  return {
    first: Math.min(state.doc.resolve(from).index(0), lastLine),
    last: Math.min(state.doc.resolve(to).index(0), lastLine),
  };
}

function activeDecorations(state, parsed, focused) {
  if (!focused) return DecorationSet.empty;
  let { first, last } = selectedLines(state);
  // A comment reveals as a whole, however many lines it spans.
  for (const c of parsed.comments) {
    if (c.lineStart <= last && c.lineEnd >= first) {
      first = Math.min(first, c.lineStart);
      last = Math.max(last, c.lineEnd);
    }
  }
  // So does a title page field, so that its key shows from any of its values.
  for (const { lines } of parsed.titlePage) {
    if (lines[0] <= last && lines[lines.length - 1] >= first) {
      first = Math.min(first, lines[0]);
      last = Math.max(last, lines[lines.length - 1]);
    }
  }
  const decorations = [];
  let pos = 0;
  for (let i = 0; i <= last; i++) {
    const size = state.doc.child(i).nodeSize;
    if (i >= first) decorations.push(Decoration.node(pos, pos + size, { class: 'fl-active' }));
    pos += size;
  }
  return DecorationSet.create(state.doc, decorations);
}

function computeGaps(state, getLayoutOptions) {
  const { parsed } = scriptKey.getState(state);
  const options = getLayoutOptions();
  const { pageStarts } = layout(parsed, options);
  // The cover page ends right after its last line, even before any script exists.
  const { last } = coverInfo(parsed, options);
  const coverGap = (pos, side) => Decoration.widget(pos, () => pageGap(1, false), { side, key: 'page-cover', ignoreSelection: true });
  const starts = new Map(pageStarts.filter((p) => p.number > 1).map((p) => [p.line, p]));
  const widgets = [];
  if (last < 0) widgets.push(Decoration.widget(0, firstPageNumber, { side: -1, key: 'page-one', ignoreSelection: true }));
  let index = 0;
  state.doc.forEach((_node, pos) => {
    if (last >= 0 && index === last + 1) widgets.push(coverGap(pos, -1));
    const start = starts.get(index++);
    if (start) {
      const { number, continued } = start;
      widgets.push(Decoration.widget(pos, () => pageGap(number, continued), { side: -1, key: `page-${number}-${continued}`, ignoreSelection: true }));
    }
  });
  if (last >= 0 && last === state.doc.childCount - 1) widgets.push(coverGap(state.doc.content.size, 1));
  return DecorationSet.create(state.doc, widgets);
}

const FountainDecorations = Extension.create({
  name: 'fountainDecorations',
  addOptions: () => ({ getLayoutOptions: () => ({}), showSource: () => false }),
  addProseMirrorPlugins() {
    const { getLayoutOptions, showSource } = this.options;
    // All formatting is decoration, so leaving it off shows the file exactly as it is.
    const shown = (decorations) => (showSource() ? DecorationSet.empty : decorations);
    return [
      new Plugin({
        key: scriptKey,
        state: {
          init: (_, state) => computeScript(state.doc, getLayoutOptions()),
          apply: (tr, value) => {
            if (tr.docChanged) return updateScript(tr, value, getLayoutOptions());
            return tr.getMeta('flowRelayout') ? computeScript(tr.doc, getLayoutOptions()) : value;
          },
        },
        props: { decorations: (state) => shown(scriptKey.getState(state).decorations) },
      }),
      new Plugin({
        key: activeKey,
        state: {
          init: () => ({ focused: false, decorations: DecorationSet.empty }),
          apply: (tr, value, _old, state) => {
            const focused = tr.getMeta('flowFocus') ?? value.focused;
            if (!tr.docChanged && !tr.selectionSet && focused === value.focused) return value;
            return { focused, decorations: activeDecorations(state, scriptKey.getState(state).parsed, focused) };
          },
        },
        props: {
          decorations: (state) => shown(activeKey.getState(state).decorations),
          handleDOMEvents: {
            focus: (view) => { view.dispatch(view.state.tr.setMeta('flowFocus', true)); return false; },
            blur: (view) => { view.dispatch(view.state.tr.setMeta('flowFocus', false)); return false; },
          },
        },
      }),
      // Hidden lines can't hold the cursor, which goes on to the next line it was heading for.
      new Plugin({
        appendTransaction: (transactions, old, state) => {
          if (showSource() || !transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
          const { selection, doc } = state;
          const { hidden } = scriptKey.getState(state);
          const index = selection.$from.index(0);
          if (!selection.empty || !hidden.has(index)) return null;
          const visible = (i) => i >= 0 && i < doc.childCount && !hidden.has(i);
          const inside = (i) => i >= 0 && i < doc.childCount;
          const step = index < old.selection.$from.index(0) ? -1 : 1;
          let target = index;
          while (inside(target) && !visible(target)) target += step;
          let down = step > 0;
          if (!visible(target)) {
            for (target = index; inside(target) && !visible(target); target -= step);
            down = !down;
          }
          if (!visible(target)) return null;
          let pos = 0;
          for (let i = 0; i < target; i++) pos += doc.child(i).nodeSize;
          return state.tr.setSelection(TextSelection.create(doc, down ? pos + 1 : pos + doc.child(target).nodeSize - 1));
        },
      }),
      // A title page value's indent is out of sight, so the cursor doesn't stop inside it.
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (showSource() || !transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
          const { selection, doc } = state;
          if (!selection.empty) return null;
          const line = scriptKey.getState(state).parsed.lines[selection.$from.index(0)];
          if (line.type !== 'title' || !TITLE_INDENT.test(line.raw) || selection.$from.parentOffset >= line.contentStart) return null;
          return state.tr.setSelection(TextSelection.create(doc, selection.$from.start() + line.contentStart));
        },
      }),
      // Page breaks need a full layout, so they follow a pause in typing.
      new Plugin({
        key: gapsKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => tr.getMeta('flowGaps') ?? set.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => shown(gapsKey.getState(state)) },
        view: (view) => {
          let timer = null;
          const refresh = () => {
            timer = null;
            if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta('flowGaps', computeGaps(view.state, getLayoutOptions)));
          };
          timer = setTimeout(refresh, 0);
          return {
            update: (_view, prev) => {
              if (prev.doc !== view.state.doc && timer === null) timer = setTimeout(refresh, GAP_DELAY_MS);
            },
            destroy: () => clearTimeout(timer),
          };
        },
      }),
    ];
  },
});

const caretKey = new PluginKey('flowCaret');

// Keys an app asked to see first, such as a key binding extension, and the block cursor it
// may ask for. They run ahead of every other key handling in the editor.
const AppKeys = Extension.create({
  name: 'flowAppKeys',
  priority: 10000,
  addOptions: () => ({ handlers: () => [], text: null }),
  addProseMirrorPlugins() {
    const { handlers, text } = this.options;
    const ask = (fn) => {
      for (const handler of handlers()) {
        try {
          if (fn(handler)) return true;
        } catch (err) {
          console.error(err);
        }
      }
      return false;
    };
    return [
      new Plugin({
        props: {
          handleKeyDown: (_view, event) => ask((handler) => handler.keydown?.(event, text()) === true),
          handleTextInput: (_view, _from, _to, typed) => ask((handler) => handler.input?.(typed, text()) === true),
        },
      }),
      new Plugin({
        key: caretKey,
        state: {
          init: () => null,
          apply: (tr, style) => (tr.getMeta(caretKey) !== undefined ? tr.getMeta(caretKey) : style),
        },
        props: {
          attributes: (state) => (caretKey.getState(state) ? { class: 'fl-caret-on' } : {}),
          decorations: (state) => {
            const caret = caretKey.getState(state);
            if (!caret || !activeKey.getState(state)?.focused) return null;
            const { selection, doc } = state;
            if (!selection.empty) return null;
            const { $head } = selection;
            const at = $head.pos;
            // A blinking cursor blinks at its own pace, set as a custom property.
            const cls = caret.blink ? ' fl-caret-blink' : '';
            const style = caret.blink ? `--fl-caret-period: ${caret.period}ms` : '';
            const deco = $head.parentOffset < $head.parent.content.size
              ? Decoration.inline(at, at + 1, { class: `fl-caret-char${cls}`, style })
              : Decoration.widget(at, () => {
                const node = document.createElement('span');
                node.className = `fl-caret-end${cls}`;
                if (style) node.setAttribute('style', style);
                return node;
              }, { side: 1, key: `caret-end${cls}${style}` });
            return DecorationSet.create(doc, [deco]);
          },
        },
      }),
    ];
  },
});

export class FlowEditor {
  constructor(mount, { value, getLayoutOptions, showSource, keyHandlers = () => [], onChange, onState }) {
    this.onChange = onChange;
    this.onState = onState;
    this.getLayoutOptions = getLayoutOptions;
    this.showSource = showSource;
    this.silent = false;
    const self = this;
    this.text = this.textApi();
    const Commands = Extension.create({
      name: 'flowKeys',
      priority: 1000, // ahead of the default Enter
      addKeyboardShortcuts: () => ({
        Enter: () => self.titleEnter(),
        Backspace: () => self.titleBackspace() || self.keepHidden(-1),
        Delete: () => self.keepHidden(1),
        ArrowLeft: () => self.titleLeft(),
        ArrowUp: () => self.titleVertical(-1),
        ArrowDown: () => self.titleVertical(1),
        'Mod-b': () => (self.emphasis('bold'), true),
        'Mod-i': () => (self.emphasis('italic'), true),
        'Mod-u': () => (self.emphasis('underline'), true),
      }),
    });
    this.editor = new Editor({
      element: mount,
      injectCSS: false,
      content: textToJson(value),
      extensions: [
        Document.extend({ content: 'line+' }),
        Line,
        Text,
        UndoRedo,
        AppKeys.configure({ handlers: keyHandlers, text: () => self.text }),
        Commands,
        FountainDecorations.configure({ getLayoutOptions, showSource }),
      ],
      editorProps: {
        attributes: { 'aria-label': 'Screenplay', 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true', autocapitalize: 'sentences' },
        // Pasted content is always treated as plain Fountain text.
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData('text/plain');
          if (text === undefined || text === '') return false;
          self.insertText(text);
          return true;
        },
        clipboardTextSerializer: (slice) => {
          const lines = [];
          slice.content.forEach((node) => lines.push(node.textContent));
          return lines.join('\n');
        },
      },
      onUpdate: () => {
        if (!self.silent) self.onChange(self.value, scriptKey.getState(self.editor.state).parsed.outline);
        self.emitState();
      },
      onSelectionUpdate: () => self.emitState(),
    });
    this.view = this.editor.view;
    this.emitState();
  }

  get value() {
    return docLines(this.editor.state.doc).join('\n');
  }

  /** The script as last parsed, which is up to date with every edit. */
  get parsed() {
    return scriptKey.getState(this.editor.state).parsed;
  }

  set value(text) {
    const { state, view } = this.editor;
    const doc = state.schema.nodeFromJSON(textToJson(text));
    const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content).setMeta('addToHistory', false);
    this.silent = true;
    view.dispatch(tr);
    this.silent = false;
  }

  /** `scroll: false` leaves the page where it is, even with the cursor out of sight. */
  focus({ scroll = true } = {}) {
    this.editor.commands.focus(null, { scrollIntoView: scroll });
  }

  /** Each line's element, in order, for keeping your place between views. */
  lineNodes() {
    return [...this.view.dom.children].filter((node) => node.classList.contains('fl-line'));
  }

  /** Whether the cursor is on screen between `top` and `bottom`. */
  cursorWithin(top, bottom) {
    const { head } = this.editor.state.selection;
    const rect = this.view.coordsAtPos(head);
    return rect.bottom > top && rect.top < bottom;
  }

  /** Puts the cursor at the start of a line without scrolling to it. */
  placeCursor(index) {
    const { state } = this.editor;
    const i = Math.max(0, Math.min(index, state.doc.childCount - 1));
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, this.lineStart(i) + 1)));
  }

  /** Keeps the cursor clear of whatever floats over the top and bottom of the scrolling area. */
  setInsets(top, bottom) {
    // The threshold is when to scroll and the margin is how far, so both have to clear them.
    const clearance = { top: top + 8, bottom: bottom + 8 };
    this.view.setProps({
      scrollThreshold: { ...clearance, right: 0, left: 0 },
      scrollMargin: { ...clearance, right: 5, left: 5 },
    });
  }

  destroy() {
    this.editor.destroy();
  }

  relayout() {
    this.view.dispatch(this.view.state.tr.setMeta('flowRelayout', true));
    this.view.dispatch(this.view.state.tr.setMeta('flowGaps', computeGaps(this.view.state, this.getLayoutOptions)));
  }

  lineStart(index) {
    let pos = 0;
    for (let i = 0; i < index; i++) pos += this.editor.state.doc.child(i).nodeSize;
    return pos;
  }

  scrollToLine(index) {
    const { state } = this.editor;
    const i = Math.max(0, Math.min(index, state.doc.childCount - 1));
    const pos = this.lineStart(i) + 1;
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)).scrollIntoView());
    this.focus();
  }

  selectText(line, from, to) {
    const start = this.lineStart(line) + 1;
    const { state } = this.editor;
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start + from, start + to)));
    this.focus();
  }

  // Replaces the whole-document line list with the smallest node-range change.
  linesTransaction(lines) {
    const { state } = this.editor;
    const before = docLines(state.doc);
    let head = 0;
    while (head < before.length && head < lines.length && before[head] === lines[head]) head++;
    let tail = 0;
    while (tail < before.length - head && tail < lines.length - head && before[before.length - 1 - tail] === lines[lines.length - 1 - tail]) tail++;
    const from = this.lineStart(head);
    const to = this.lineStart(before.length - tail);
    const nodes = lines.slice(head, lines.length - tail).map((t) => state.schema.nodeFromJSON(lineToJson(t)));
    return state.tr.replace(from, to, new Slice(Fragment.from(nodes), 0, 0));
  }

  commit(lines, cursor) {
    const tr = this.linesTransaction(lines);
    if (cursor) {
      let pos = 0;
      for (let i = 0; i < cursor.line; i++) pos += tr.doc.child(i).nodeSize;
      tr.setSelection(TextSelection.create(tr.doc, pos + 1 + cursor.from, pos + 1 + (cursor.to ?? cursor.from)));
    }
    // Each ribbon action is its own undo step, however quickly they follow each other.
    this.editor.view.dispatch(closeHistory(tr).scrollIntoView());
    this.focus();
  }

  /**
   * Puts in changes made somewhere else, such as by someone writing in the same script: a list
   * of { from, to, text }, with offsets into the script's text, in order and apart. They aren't
   * steps of this editor's undo, which maps its own steps past them, so undo only takes back what
   * was written here. The cursor moves with the text around it, and the page stays put.
   */
  applyChanges(changes) {
    const tr = this.editor.state.tr;
    // The last first, so that the offsets before each one still hold.
    for (const { from, to, text } of [...changes].sort((x, y) => y.from - x.from)) {
      replaceText(tr, offsetPos(tr.doc, from), offsetPos(tr.doc, to), text);
    }
    if (tr.docChanged) this.view.dispatch(tr.setMeta('addToHistory', false));
  }

  // Edits from the Outline tab, where the script is hidden and keeps its place. Typing
  // joins the undo step before it, and anything else is a step of its own.
  commitFromOutline(lines, { typing = false } = {}) {
    const tr = this.linesTransaction(lines);
    this.editor.view.dispatch(typing ? tr : closeHistory(tr));
  }

  titleEnter() {
    const { selection, doc } = this.editor.state;
    if (!selection.empty) return false;
    const result = continueTitleField(docLines(doc), selection.$from.index(0), selection.$from.parentOffset);
    if (result) this.commit(result.lines, result.cursor);
    return !!result;
  }

  // The title page line the cursor is on, unless the indents are on show in the Fountain view.
  titleCursor() {
    const { selection } = this.editor.state;
    if (this.showSource() || !selection.empty) return null;
    const index = selection.$from.index(0);
    const line = scriptKey.getState(this.editor.state).parsed.lines[index];
    return line.type === 'title' ? { index, line, offset: selection.$from.parentOffset } : null;
  }

  atValueStart({ index, line, offset }) {
    return index > 0 && TITLE_INDENT.test(line.raw) && offset <= line.contentStart;
  }

  titleBackspace() {
    const current = this.titleCursor();
    if (!current || !this.atValueStart(current)) return false;
    const { lines, cursor } = joinTitleValue(docLines(this.editor.state.doc), current.index);
    this.commit(lines, cursor);
    return true;
  }

  // Joining a line with a hidden one would pull the settings into sight, or the script into
  // the title page, so nothing happens at the edge of one.
  keepHidden(direction) {
    const { selection } = this.editor.state;
    if (this.showSource() || !selection.empty) return false;
    const { $from } = selection;
    const atEdge = direction < 0 ? $from.parentOffset === 0 : $from.parentOffset === $from.parent.content.size;
    return atEdge && scriptKey.getState(this.editor.state).hidden.has($from.index(0) + direction);
  }

  // Left from where a value starts would only land in its hidden indent.
  titleLeft() {
    const current = this.titleCursor();
    if (!current || !this.atValueStart(current)) return false;
    const { state } = this.editor;
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, this.lineStart(current.index) - 1)).scrollIntoView());
    return true;
  }

  // Title page lines are placed around the page, so the browser can't follow them by sight.
  // These go through them in order, leaving a wrapped line's own rows to the browser.
  titleVertical(direction) {
    const current = this.titleCursor();
    if (!current || !this.view.endOfTextblock(direction < 0 ? 'up' : 'down')) return false;
    const { index, line, offset } = current;
    const { parsed, hidden } = scriptKey.getState(this.editor.state);
    let next = index + direction;
    while (hidden.has(next)) next += direction;
    const target = parsed.lines[next];
    // With only hidden lines beyond, the cursor stays where it is.
    if (!target) return next !== index + direction;
    if (target.type !== 'title') return false;
    const column = Math.max(0, offset - line.contentStart);
    const end = Math.max(target.contentStart, target.contentEnd);
    const { state } = this.editor;
    const pos = this.lineStart(next) + 1 + Math.min(target.contentStart + column, end);
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)).scrollIntoView());
    return true;
  }

  setLineType(type) {
    const { first, last } = selectedLines(this.editor.state);
    const { lines, cursor } = applyLineType(docLines(this.editor.state.doc), first, last, type);
    this.commit(lines, cursor);
  }

  pageBreak() {
    const { last } = selectedLines(this.editor.state);
    const { lines, cursor } = insertPageBreak(docLines(this.editor.state.doc), last);
    this.commit(lines, cursor);
  }

  boneyard() {
    const { state } = this.editor;
    const { first, last } = selectedLines(state);
    const fromCh = Math.max(state.selection.from - (this.lineStart(first) + 1), 0);
    const toCh = Math.min(state.selection.to - (this.lineStart(last) + 1), state.doc.child(last).content.size);
    const { lines, cursor } = toggleBoneyard(docLines(state.doc), first, fromCh, last, toCh);
    this.commit(lines, cursor);
  }

  dual() {
    const { first } = selectedLines(this.editor.state);
    const result = toggleDual(docLines(this.editor.state.doc), first);
    if (result) this.commit(result.lines, result.cursor);
  }

  emphasis(style) {
    const { state, view } = this.editor;
    // Keep a select-all's outer positions inside the text.
    const from = Math.max(state.selection.from, 1);
    const to = Math.min(state.selection.to, state.doc.content.size - 1);
    const { first, last } = selectedLines(state);
    const { parsed } = scriptKey.getState(state);
    const tr = state.tr;
    let selFrom = from;
    let selTo = to;
    // Emphasis can't cross line breaks in Fountain, so each line is wrapped on its own.
    for (let i = last; i >= first; i--) {
      const line = parsed.lines[i];
      if (first !== last && line.blank) continue;
      const start = this.lineStart(i) + 1;
      const a = i === first ? from - start : line.contentStart ?? 0;
      const b = i === last ? to - start : line.contentEnd ?? line.raw.length;
      const result = toggleEmphasis(line.raw, a, b, style, line.contentStart ?? 0, line.contentEnd ?? line.raw.length);
      const content = result.text ? state.schema.text(result.text) : Fragment.empty;
      tr.replaceWith(start, start + line.raw.length, content);
      if (i === first) selFrom = start + result.from;
      if (i === last) selTo = start + result.to;
    }
    if (first !== last) selTo = tr.mapping.map(to);
    tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo));
    view.dispatch(closeHistory(tr));
    this.focus();
  }

  insertText(text) {
    const { state, view } = this.editor;
    const parts = parse(text).source.split('\n');
    const nodes = parts.map((t) => state.schema.nodeFromJSON(lineToJson(t)));
    // Open on both ends so the first and last pasted lines merge into the current ones.
    const slice = new Slice(Fragment.from(nodes), 1, 1);
    view.dispatch(state.tr.replaceSelection(slice).scrollIntoView());
  }

  /**
   * The script as lines, for an app's key handlers. Places are { line, ch }: a source line and
   * a character in it, from 0.
   *
   *   lineCount, line(i), lines()      the source lines
   *   cursor()                         where the cursor is: the selection's head
   *   selection()                      { anchor, head }
   *   setCursor(place)                 moves the cursor there, emptying the selection
   *   select(anchor, head)             selects from anchor to head
   *   replace(from, to, text, cursor)  replaces the text between two places as one undo step,
   *                                    `text` may hold line breaks, then puts the cursor at
   *                                    `cursor` in the new text, if given. With { join: true }
   *                                    as a fifth argument, it joins the step before, as typing
   *                                    does
   *   undo(), redo()
   *   setCaret(style, options)         'block' draws the cursor over the character it's on;
   *                                    null for the usual line. `options` is { blink, period },
   *                                    to blink every `period` milliseconds
   *   screenLine(from, dir, x)         where the cursor lands one row down (dir 1) or up (-1)
   *                                    on screen, following wrapped lines, as { place, x }, at
   *                                    `x`, a distance across the screen to keep to, or its own;
   *                                    null when there's no row there
   *   hidden(i)                        whether line i is out of sight, such as the settings
   */
  textApi() {
    const state = () => this.editor.state;
    const place = (pos) => {
      const $pos = state().doc.resolve(pos);
      if ($pos.depth === 0) {
        const line = Math.min($pos.index(0), state().doc.childCount - 1);
        return { line, ch: pos >= state().doc.content.size ? state().doc.child(line).content.size : 0 };
      }
      return { line: $pos.index(0), ch: $pos.parentOffset };
    };
    const posIn = (doc, { line, ch }) => {
      const i = Math.max(0, Math.min(Math.trunc(line) || 0, doc.childCount - 1));
      let pos = 0;
      for (let n = 0; n < i; n++) pos += doc.child(n).nodeSize;
      return pos + 1 + Math.max(0, Math.min(Math.trunc(ch) || 0, doc.child(i).content.size));
    };
    const dispatch = (tr) => this.view.dispatch(tr.scrollIntoView());
    return {
      get lineCount() { return state().doc.childCount; },
      line: (i) => state().doc.child(i)?.textContent ?? '',
      lines: () => docLines(state().doc),
      cursor: () => place(state().selection.head),
      selection: () => ({ anchor: place(state().selection.anchor), head: place(state().selection.head) }),
      setCursor: (at) => {
        const { doc, tr } = state();
        dispatch(tr.setSelection(TextSelection.create(doc, posIn(doc, at))));
      },
      select: (anchor, head) => {
        const { doc, tr } = state();
        dispatch(tr.setSelection(TextSelection.create(doc, posIn(doc, anchor), posIn(doc, head))));
      },
      replace: (from, to, text, cursor, { join = false } = {}) => {
        const { doc, tr } = state();
        let a = posIn(doc, from);
        let b = posIn(doc, to);
        if (a > b) [a, b] = [b, a];
        replaceText(tr, a, b, String(text ?? '').replace(/\r\n?/g, '\n'));
        if (cursor) tr.setSelection(TextSelection.create(tr.doc, posIn(tr.doc, cursor)));
        // Joining the undo step before it, as typing does; otherwise it's a step of its own.
        dispatch(join ? tr : closeHistory(tr));
      },
      undo: () => this.undo(),
      redo: () => this.redo(),
      setCaret: (style, { blink = false, period = 1000 } = {}) => {
        if (this.view.isDestroyed) return;
        const caret = style === 'block' ? { blink: !!blink, period: Math.max(200, Number(period) || 1000) } : null;
        this.view.dispatch(state().tr.setMeta(caretKey, caret));
      },
      screenLine: (from, direction, goalX = null) => this.screenLine(posIn(state().doc, from), direction, goalX, place),
      hidden: (i) => scriptKey.getState(state()).hidden.has(i),
    };
  }

  // Finds the position one row up or down on screen from `pos`, near `goalX`, by looking just
  // beyond the row it's on, a little further each time, past the gaps between lines and pages.
  // Lines sit in columns of their own, such as dialogue, narrower and further in than action, so
  // a place across that falls before the row's start lands at its start, and one after its end,
  // at its end.
  screenLine(pos, direction, goalX, place) {
    const { view } = this;
    const start = view.coordsAtPos(pos);
    const height = Math.max(4, start.bottom - start.top);
    const x = goalX ?? start.left;
    // Rows are found down the middle of the page, which every line's column crosses, so a line
    // set further in, such as a character cue, isn't passed over.
    const page = view.dom.getBoundingClientRect();
    const across = page.left + page.width / 2;
    for (let step = 1; step <= 16; step++) {
      const reach = (step - 0.5) * (height / 2);
      const top = direction > 0 ? start.bottom + reach : start.top - reach;
      const hit = view.posAtCoords({ left: across, top });
      if (!hit || hit.pos === pos) continue;
      const found = view.coordsAtPos(hit.pos);
      if (direction > 0 ? found.top < start.bottom - 1 : found.bottom > start.top + 1) continue;
      return { place: place(this.alongRow(hit.pos, found, x)), x };
    }
    return null;
  }

  // The position on the row holding `pos` nearest to `x`: its start when `x` is before the row,
  // its end when after it, or where `x` falls on it.
  alongRow(pos, coords, x) {
    const { view } = this;
    const dom = view.domAtPos(pos).node;
    const line = (dom.nodeType === 1 ? dom : dom.parentElement)?.closest('.fl-line');
    if (!line) return pos;
    const box = line.getBoundingClientRect();
    const middle = (coords.top + coords.bottom) / 2;
    const rowStart = view.posAtCoords({ left: box.left + 1, top: middle })?.pos;
    const rowEnd = view.posAtCoords({ left: box.right - 1, top: middle })?.pos;
    if (rowStart == null || rowEnd == null) return pos;
    // A row's ends, by the positions on the same row as `pos`.
    const sameRow = (at) => Math.abs((view.coordsAtPos(at).top + view.coordsAtPos(at).bottom) / 2 - middle) < (coords.bottom - coords.top) / 2;
    const first = sameRow(rowStart) ? rowStart : pos;
    const last = sameRow(rowEnd) ? rowEnd : pos;
    if (x <= view.coordsAtPos(first).left) return first;
    if (x >= view.coordsAtPos(last).left) return last;
    return view.posAtCoords({ left: x, top: middle })?.pos ?? pos;
  }

  undo({ focus = true } = {}) {
    this.editor.commands.undo();
    if (focus) this.focus();
  }

  redo({ focus = true } = {}) {
    this.editor.commands.redo();
    if (focus) this.focus();
  }

  emitState() {
    const { state } = this.editor;
    const { parsed } = scriptKey.getState(state);
    const { first, last } = selectedLines(state);
    const line = parsed.lines[first];
    const start = this.lineStart(first) + 1;
    const from = Math.max(state.selection.from, start);
    const to = Math.min(state.selection.to, start + line.raw.length);
    const emphasis = first === last && line.contentStart !== undefined
      ? emphasisAt(line.raw, from - start, to - start, line.contentStart, line.contentEnd)
      : { bold: false, italic: false, underline: false };
    const selStart = line.start + Math.max(state.selection.from - start, 0);
    const selEnd = parsed.lines[last].start + Math.max(state.selection.to - (this.lineStart(last) + 1), 0);
    this.onState({
      type: lineTypeKey(line),
      boneyard: parsed.comments.some((c) => c.type === 'boneyard' && c.start <= selEnd && selStart <= c.end),
      dual: dualAt(parsed.lines, first),
      ...emphasis,
      canUndo: this.editor.can().undo(),
      canRedo: this.editor.can().redo(),
    });
  }
}
