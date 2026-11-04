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
import { parse, layout, applyLineType, insertPageBreak, toggleBoneyard, toggleDual, toggleEmphasis, emphasisAt, lineTypeKey } from '@flow/core';

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
  // Page 1 only gets a break when a title page sits before it. It prints unnumbered.
  dom.className = number === 1 ? 'fl-page-gap fl-title-gap' : 'fl-page-gap';
  dom.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  if (number > 1) label.textContent = continued ? `(CONTINUED)  ${number}.` : `${number}.`;
  dom.append(label);
  return dom;
}

const scriptKey = new PluginKey('flowScript');
const activeKey = new PluginKey('flowActive');
const gapsKey = new PluginKey('flowGaps');
const GAP_DELAY_MS = 200;

// Later lines of a note fold into its bubble. A boneyard has no bubble, so all of it stays visible.
const isCommentTail = (line, index) => line.commentOnly && line.comments.every((c) => c.comment.type === 'note' && c.comment.lineStart !== index);

// Everything a line's decorations depend on, so unchanged lines can be left alone.
function lineSignature(line, index) {
  const openingComments = line.comments.filter((c) => c.comment.lineStart === index).map((c) => c.comment.text);
  return [line.raw, line.masked, lineClasses(line), isCommentTail(line, index), ...openingComments].join('\u0001');
}

function openCommentAt(view, pos) {
  const { doc } = view.state;
  // Just past the opening [[, ready to edit.
  view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, Math.min(pos + 2, doc.content.size - 1))));
  view.focus();
}

function lineDecorations(node, pos, line, index) {
  const decorations = [];
  const at = (offset) => pos + 1 + offset;
  decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: `${lineClasses(line)}${isCommentTail(line, index) ? ' fl-comment-hidden' : ''}` }));
  for (const [a, b] of line.markers) if (b > a) decorations.push(Decoration.inline(at(a), at(b), { class: 'fl-marker' }));
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

function computeScript(doc) {
  const parsed = parse(docLines(doc).join('\n'));
  const signatures = parsed.lines.map(lineSignature);
  const decorations = [];
  let index = 0;
  doc.forEach((node, pos) => {
    decorations.push(...lineDecorations(node, pos, parsed.lines[index], index));
    index++;
  });
  return { parsed, signatures, decorations: DecorationSet.create(doc, decorations) };
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
function updateScript(tr, prev) {
  const touched = touchedLines(tr);
  if (!touched) return computeScript(tr.doc);
  const parsed = parse(docLines(tr.doc).join('\n'));
  const signatures = parsed.lines.map(lineSignature);
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
    add.push(...lineDecorations(node, pos, parsed.lines[i], i));
  });
  if (remove.length) decorations = decorations.remove(remove);
  if (add.length) decorations = decorations.add(tr.doc, add);
  return { parsed, signatures, decorations };
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
  const { pageStarts } = layout(scriptKey.getState(state).parsed, getLayoutOptions());
  const starts = new Map(pageStarts.map((p) => [p.line, p]));
  const widgets = [];
  let index = 0;
  state.doc.forEach((_node, pos) => {
    const start = starts.get(index++);
    if (start) {
      const { number, continued } = start;
      widgets.push(Decoration.widget(pos, () => pageGap(number, continued), { side: -1, key: `page-${number}-${continued}`, ignoreSelection: true }));
    }
  });
  return DecorationSet.create(state.doc, widgets);
}

const FountainDecorations = Extension.create({
  name: 'fountainDecorations',
  addOptions: () => ({ getLayoutOptions: () => ({}) }),
  addProseMirrorPlugins() {
    const { getLayoutOptions } = this.options;
    return [
      new Plugin({
        key: scriptKey,
        state: {
          init: (_, state) => computeScript(state.doc),
          apply: (tr, value) => (tr.docChanged ? updateScript(tr, value) : value),
        },
        props: { decorations: (state) => scriptKey.getState(state).decorations },
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
          decorations: (state) => activeKey.getState(state).decorations,
          handleDOMEvents: {
            focus: (view) => { view.dispatch(view.state.tr.setMeta('flowFocus', true)); return false; },
            blur: (view) => { view.dispatch(view.state.tr.setMeta('flowFocus', false)); return false; },
          },
        },
      }),
      // Page breaks need a full layout, so they follow a pause in typing.
      new Plugin({
        key: gapsKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => tr.getMeta('flowGaps') ?? set.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => gapsKey.getState(state) },
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

export class FlowEditor {
  constructor(mount, { value, getLayoutOptions, onChange, onState }) {
    this.onChange = onChange;
    this.onState = onState;
    this.getLayoutOptions = getLayoutOptions;
    this.silent = false;
    const self = this;
    const Commands = Extension.create({
      name: 'flowKeys',
      addKeyboardShortcuts: () => ({
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
        Commands,
        FountainDecorations.configure({ getLayoutOptions }),
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

  set value(text) {
    const { state, view } = this.editor;
    const doc = state.schema.nodeFromJSON(textToJson(text));
    const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content).setMeta('addToHistory', false);
    this.silent = true;
    view.dispatch(tr);
    this.silent = false;
  }

  focus() {
    this.editor.commands.focus();
  }

  destroy() {
    this.editor.destroy();
  }

  relayout() {
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

  // Replaces the whole-document line list with the smallest node-range change.
  commit(lines, cursor) {
    const { state, view } = this.editor;
    const before = docLines(state.doc);
    let head = 0;
    while (head < before.length && head < lines.length && before[head] === lines[head]) head++;
    let tail = 0;
    while (tail < before.length - head && tail < lines.length - head && before[before.length - 1 - tail] === lines[lines.length - 1 - tail]) tail++;
    const from = this.lineStart(head);
    const to = this.lineStart(before.length - tail);
    const nodes = lines.slice(head, lines.length - tail).map((t) => state.schema.nodeFromJSON(lineToJson(t)));
    const tr = state.tr.replace(from, to, new Slice(Fragment.from(nodes), 0, 0));
    if (cursor) {
      let pos = 0;
      for (let i = 0; i < cursor.line; i++) pos += tr.doc.child(i).nodeSize;
      tr.setSelection(TextSelection.create(tr.doc, pos + 1 + cursor.from, pos + 1 + (cursor.to ?? cursor.from)));
    }
    // Each ribbon action is its own undo step, however quickly they follow each other.
    view.dispatch(closeHistory(tr).scrollIntoView());
    this.focus();
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

  undo() { this.editor.commands.undo(); this.focus(); }
  redo() { this.editor.commands.redo(); this.focus(); }

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
      dual: !!line.dual,
      ...emphasis,
      canUndo: this.editor.can().undo(),
      canRedo: this.editor.can().redo(),
    });
  }
}
