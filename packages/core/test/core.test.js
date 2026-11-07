import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { newScript, parse, parseInline, layout, titlePositions, wrapRuns, applyLineType, insertPageBreak, toggleBoneyard, toggleDual, toggleEmphasis, emphasisAt, lineTypeKey, dualAt, scriptTitle, continueTitleField, joinTitleValue, outlineCards, outlineSlots, moveOutlineBlock, setOutlineSceneNumber, addOutlineSection, addOutlineSynopsis, setOutlineText, removeOutlineCard, removeOutlineSynopsis, parseDimensions, formatDimensions, pageProfile, resolvePaper, writeSetting } from '../src/index.js';
import { renderPdf } from '../src/pdf.js';

const types = (src) => parse(src).lines.map((l) => l.type);
const typeOf = (src, needle) => parse(src).lines.find((l) => l.raw.includes(needle)).type;
const pageText = (page) => page.rows.map((r) => r.cells.map((c) => c.runs.map((x) => x.text).join('')).join(' | '));

describe('element classification', () => {
  it('detects scene headings, requiring blank lines around them', () => {
    expect(typeOf('\nINT. HOUSE - DAY\n', 'INT')).toBe('scene');
    expect(typeOf('\next. park\n', 'ext')).toBe('scene');
    expect(typeOf('\nINT./EXT. CAR\n', 'INT')).toBe('scene');
    expect(typeOf('\nI/E CAR\n', 'I/E')).toBe('scene');
    expect(typeOf('text\nINT. HOUSE\n', 'INT')).toBe('action');
    expect(typeOf('\nINTERIOR\n', 'INTERIOR')).toBe('action');
  });
  it('forces scene headings with a period, but not an ellipsis', () => {
    expect(typeOf('\n.SNIPER POV\n', 'SNIPER')).toBe('scene');
    expect(typeOf('\n...and then\n', 'and')).toBe('action');
  });
  it('reads scene numbers', () => {
    const l = parse('\nINT. HOUSE #1A-2#\n').lines[1];
    expect(l.sceneNumber).toBe('1A-2');
    expect(l.text).toBe('INT. HOUSE');
  });
  it('detects character, parenthetical and dialogue blocks', () => {
    expect(types('\nSTEEL (O.S.)\n(quietly)\nHello.\nAgain.\n\nNext')).toEqual(['blank', 'character', 'parenthetical', 'dialogue', 'dialogue', 'blank', 'action']);
  });
  it('does not treat an uppercase line with nothing beneath it as a character', () => {
    expect(typeOf('\nSTEEL\n\nmore', 'STEEL')).toBe('action');
    expect(typeOf('text\nSTEEL\nhello', 'STEEL')).toBe('action');
  });
  it('supports forced elements', () => {
    expect(typeOf('\n@McCLANE\nHi', 'McCLANE')).toBe('character');
    expect(typeOf('\n!LOUD NOISE\nhi', 'LOUD')).toBe('action');
    expect(typeOf('> Burn to White.', 'Burn')).toBe('transition');
    expect(typeOf('~Sing a song', 'Sing')).toBe('lyrics');
    expect(typeOf('>THE END<', 'THE')).toBe('centered');
    expect(parse('> THE END <').lines[0].text).toBe('THE END');
  });
  it('detects transitions and honors the trailing-space opt out', () => {
    expect(typeOf('\nCUT TO:\n', 'CUT')).toBe('transition');
    expect(typeOf('\nCUT TO:  \n', 'CUT')).toBe('action');
  });
  it('keeps a two-space line inside dialogue', () => {
    expect(types('\nA\nline one\n  \nline two')).toEqual(['blank', 'character', 'dialogue', 'dialogue', 'dialogue']);
  });
  it('handles lyrics inside dialogue', () => {
    const l = parse('\nSINGER\n~la la').lines[2];
    expect(l.type).toBe('lyrics');
    expect(l.inDialogue).toBe(true);
  });
  it('flags dual dialogue', () => {
    const l = parse('\nBOB ^\nHi').lines[1];
    expect(l.dual).toBe(true);
    expect(l.text).toBe('BOB');
  });
  it('recognises page breaks, sections and synopses', () => {
    expect(types('===\n# Act\n## Seq\n= summary')).toEqual(['page-break', 'section', 'section', 'synopsis']);
  });
});

describe('title page', () => {
  it('parses keys and indented values', () => {
    const p = parse('Title: BIG\nCredit: by\nAuthor: Me\nContact:\n   a@b.c\n   555\n\nAction here');
    expect(p.titlePage.map((e) => e.key)).toEqual(['title', 'credit', 'author', 'contact']);
    expect(p.titlePage[3].lines).toHaveLength(3);
    expect(p.lines[0].text).toBe('BIG');
    expect(p.lines[7].type).toBe('action');
  });
  it('does not mistake other opening lines for title metadata', () => {
    expect(parse('FADE IN:\n\nAction').titlePage).toEqual([]);
    expect(parse('JOHN: hi').titlePage).toEqual([]);
  });
});

describe('comments', () => {
  it('finds inline and whole-line notes without disturbing classification', () => {
    const p = parse('\nBOB [[check name]]\nHi [[inline]] there');
    expect(p.lines[1].type).toBe('character');
    expect(p.lines[1].text.trim()).toBe('BOB');
    expect(p.lines[2].text).toBe('Hi  there');
    expect(p.comments.map((c) => c.text)).toEqual(['check name', 'inline']);
  });
  it('supports multi-line notes and boneyard', () => {
    const p = parse('[[one\n  \ntwo]]\n\n/* gone\n\nstill gone */\nAction');
    expect(p.comments.map((c) => c.type)).toEqual(['note', 'boneyard']);
    expect(p.lines[0].type).toBe('comment');
    expect(p.lines[6].type).toBe('comment');
    expect(p.lines[7].type).toBe('action');
  });
  it('leaves unclosed or blank-line-split notes as text', () => {
    expect(parse('hello [[ oops').comments).toEqual([]);
    expect(parse('[[ a\n\nb ]]').comments).toEqual([]);
  });
  it('treats comment-only lines as transparent to context', () => {
    expect(types('\n[[note]]\nBOB\n[[note]]\nHi')).toEqual(['blank', 'comment', 'character', 'comment', 'dialogue']);
  });
});

describe('emphasis', () => {
  const styled = (s) => parseInline(s).runs.map((r) => [s.slice(r.start, r.end), !!r.bold, !!r.italic, !!r.underline]);
  it('handles each style', () => {
    expect(styled('*i*')).toEqual([['i', false, true, false]]);
    expect(styled('**b**')).toEqual([['b', true, false, false]]);
    expect(styled('***bi***')).toEqual([['bi', true, true, false]]);
    expect(styled('_u_')).toEqual([['u', false, false, true]]);
  });
  it('nests', () => {
    expect(styled('**a *b* c**')).toEqual([['a ', true, false, false], ['b', true, true, false], [' c', true, false, false]]);
    expect(styled('_*x*_')).toEqual([['x', false, true, true]]);
    expect(styled('*a **b***')).toEqual([['a ', false, true, false], ['b', true, true, false]]);
  });
  it('requires delimiters to hug their text', () => {
    expect(styled('2 * 3 * 4')).toEqual([['2 * 3 * 4', false, false, false]]);
    expect(styled('** a **')).toEqual([['** a **', false, false, false]]);
  });
  it('honors escapes and ignores snake_case', () => {
    expect(parse('\\*no\\*').lines[0].text).toBe('*no*');
    expect(styled('snake_case_name')).toEqual([['snake_case_name', false, false, false]]);
  });
  it('does not treat an empty pair as emphasis', () => {
    expect(styled('****')).toEqual([['****', false, false, false]]);
  });
});

describe('outline', () => {
  it('nests sections and scenes and keeps synopses, without printing them', () => {
    const src = '# Act One\n= the setup\n\n## Morning\n\nINT. A - DAY\n\n= a scene note\n\nAction.\n\n## Night\n\nEXT. B - NIGHT\n\n# Act Two\n\nINT. C - DAY\n';
    const { outline } = parse(src);
    expect(outline.map((n) => n.title)).toEqual(['Act One', 'Act Two']);
    expect(outline[0].synopses).toEqual(['the setup']);
    expect(outline[0].children.map((n) => n.title)).toEqual(['Morning', 'Night']);
    expect(outline[0].children[0].children[0]).toMatchObject({ type: 'scene', title: 'INT. A - DAY', synopses: ['a scene note'] });
    expect(outline[1].children[0].title).toBe('INT. C - DAY');
    const printed = layout(parse(src)).pages.flatMap(pageText).join('\n');
    expect(printed).not.toMatch(/Act One|Morning|setup|scene note/);
    expect(printed).toContain('INT. A - DAY');
  });
  it('hidden lines leave no gap behind', () => {
    const rows = layout(parse('Action one.\n\n# Hidden\n\n= hidden too\n\nAction two.')).pages[0].rows;
    expect(rows.map((r) => r.cells.length)).toEqual([1, 0, 1]);
  });
});

describe('outline cards', () => {
  const cards = (lines) => outlineCards(parse(lines.join('\n')));
  const synopses = (card) => card.children.filter((c) => c.kind === 'synopsis').map((c) => c.text);
  const sequences = (card) => card.children.filter((c) => c.kind === 'section');

  it('nests sub-headers and shows every synopsis', () => {
    const [act] = cards(['# Act', '= one', '= two', '', '= apart', '', '## Seq', '= three', '', 'INT. A - DAY', '', '= on the scene', '', '### Deep']);
    expect(act.text).toBe('Act');
    expect(synopses(act)).toEqual(['one', 'two', 'apart']);
    const [seq] = sequences(act);
    expect(seq).toMatchObject({ text: 'Seq', level: 2, line: 6 });
    expect(synopses(seq)).toEqual(['three', 'on the scene']);
    expect(seq.children[1]).toMatchObject({ kind: 'block', text: 'INT. A - DAY', line: 9, end: 11 });
    expect(seq.children[3]).toMatchObject({ kind: 'section', text: 'Deep', level: 3 });
  });

  it('keeps synopses and sequences above the first act at the top level', () => {
    const list = cards(['= My synopsis', '## A sequence', '# My act', '= of the act']);
    expect(list.map((c) => [c.kind, c.text])).toEqual([['synopsis', 'My synopsis'], ['section', 'A sequence'], ['section', 'My act']]);
    expect(synopses(list[2])).toEqual(['of the act']);
  });

  it('a heading with a synopsis directly under it stays what it is', () => {
    const { lines } = parse('Action.\n\nINT. A - DAY\n= note\n\nCUT TO:\n= note\n\nBOB\nHi.');
    expect(lines[2].type).toBe('scene');
    expect(lines[5].type).toBe('transition');
    expect(parse('INT. A - DAY\n===\n').lines[0].type).not.toBe('scene');
  });

  it('shows a synopsis wherever it sits, in order among the cards', () => {
    const [act] = cards(['# A', '', 'INT. X - DAY', '', 'Text.', '= one', '', 'INT. Y - DAY']);
    expect(act.children.map((c) => [c.kind, c.text])).toEqual([['block', 'INT. X - DAY'], ['synopsis', 'one'], ['block', 'INT. Y - DAY']]);
    expect(act.children[0].end).toBe(5);
  });

  it('shows synopses that follow a blank line', () => {
    expect(synopses(cards(['# A', '', '= one', '= two'])[0])).toEqual(['one', 'two']);
    expect(cards(['= one', '= two']).map((c) => c.text)).toEqual(['one', 'two']);
  });

  it('lists scene cards in script order, each with the transitions beside its scene', () => {
    const list = cards(['Title: T', '', '.OPENING', '', 'Action.', '', 'CUT TO:', '', '# A', '', 'INT. B - DAY', '', 'BOB', 'Hi.', '', '> FADE OUT.']);
    expect(list.map((c) => [c.kind, c.text])).toEqual([['block', 'OPENING'], ['section', 'A']]);
    expect(list[0]).toMatchObject({ scene: true, line: 2, end: 8 });
    expect(list[0].lines).toEqual([
      { kind: 'scene', line: 2, text: 'OPENING', forced: true, number: '' },
      { kind: 'transition', line: 6, text: 'CUT TO:', forced: false, number: '' },
    ]);
    expect(list[1].children[0].lines.map((l) => l.text)).toEqual(['INT. B - DAY', 'FADE OUT.']);
  });

  describe('scene cards hold one scene and one transition at most', () => {
    const T = (n) => [`> T${n}`, ''];
    const S = (n) => [`.S${n}`, ''];
    const shape = (...parts) => cards(parts.flat()).map((c) => c.lines.map((l) => l.text).join(' '));

    it('transition, scene, transition, scene is two cards', () => {
      expect(shape(T(1), S(1), T(2), S(2))).toEqual(['T1 S1', 'T2 S2']);
    });
    it('two transitions are two cards', () => {
      expect(shape(T(1), T(2))).toEqual(['T1', 'T2']);
    });
    it('transition, scene, transition is two cards', () => {
      expect(shape(T(1), S(1), T(2))).toEqual(['T1 S1', 'T2']);
    });
    it('two scenes are two cards', () => {
      expect(shape(S(1), S(2))).toEqual(['S1', 'S2']);
    });
    it('a scene then a transition share a card too', () => {
      expect(shape(S(1), T(1), S(2), T(2))).toEqual(['S1 T1', 'S2 T2']);
    });
    it('a card moves as a whole, up to where the next one starts', () => {
      const lines = [...T(1), ...S(1), 'Action.', '', ...T(2), ...S(2)];
      expect(cards(lines).map((c) => [c.line, c.end, c.text])).toEqual([[0, 6, 'S1'], [6, 10, 'S2']]);
      expect(moveOutlineBlock(lines, 6, 0).lines).toEqual(['> T2', '', '.S2', '', '> T1', '', '.S1', '', 'Action.']);
    });
  });

  describe('scene numbers', () => {
    const numberOf = (line) => parse(line).lines[0].sceneNumber;

    it('shows a scene number apart from the heading', () => {
      expect(cards(['INT. A - DAY #12A#'])[0].lines[0]).toMatchObject({ text: 'INT. A - DAY', number: '12A' });
    });
    it('adds one after the heading', () => {
      const [line] = setOutlineSceneNumber(['INT. A - DAY'], 0, '7');
      expect(line).toBe('INT. A - DAY #7#');
      expect(numberOf(line)).toBe('7');
      expect(parse(line).lines[0].type).toBe('scene');
    });
    it('changes one in place', () => {
      expect(setOutlineSceneNumber(['INT. A - DAY #7#'], 0, '8A')).toEqual(['INT. A - DAY #8A#']);
    });
    it('clears one', () => {
      expect(setOutlineSceneNumber(['INT. A - DAY #7#'], 0, '')).toEqual(['INT. A - DAY']);
    });
    it('keeps a comment at the end of the line', () => {
      const [line] = setOutlineSceneNumber(['INT. A - DAY [[note]]'], 0, '7');
      expect(line).toBe('INT. A - DAY #7# [[note]]');
      expect(numberOf(line)).toBe('7');
    });
    it('drops anything that a scene number cannot hold', () => {
      expect(setOutlineSceneNumber(['.A'], 0, '1 #2!')).toEqual(['.A #12#']);
    });
  });

  it('keeps showing a synopsis whose act was removed, under what is now above it', () => {
    const list = cards(removeOutlineCard(['# A', '', 'INT. B - DAY', '', '# C', '= kept'], 4));
    expect(list[0].children.map((c) => [c.kind, c.text])).toEqual([['block', 'INT. B - DAY'], ['synopsis', 'kept']]);
  });

  describe('moving', () => {
    const SCRIPT = ['Title: T', '', '# A', '= a', '', 'Loose.', '', 'INT. ONE - DAY', '', 'BOB', 'Hi.', '', 'CUT TO:', '', 'INT. TWO - DAY', '', 'Two.', '', '## S', '', 'INT. THREE - DAY', '', '# B', '', 'INT. FOUR - DAY'];
    const slotsFor = (lines, line) => outlineSlots(outlineCards(parse(lines.join('\n'))), lines.length, line);
    const movedTo = (lines, line, target) => moveOutlineBlock(lines, line, target).lines;
    const types = (lines) => parse(lines.join('\n')).lines.filter((l) => !l.blank).map((l) => l.type);

    it('moves a scene with its dialogue and transition, and keeps every line what it was', () => {
      const lines = movedTo(SCRIPT, 7, 18); // below scene TWO, above the sequence
      expect(lines.slice(2, 20)).toEqual(['# A', '= a', '', 'Loose.', '', 'INT. TWO - DAY', '', 'Two.', '', 'INT. ONE - DAY', '', 'BOB', 'Hi.', '', 'CUT TO:', '', '## S', '']);
      expect(types(lines).sort()).toEqual(types(SCRIPT).sort());
    });

    it('keeps a transition with its scene when the scene after it moves up', () => {
      const lines = movedTo(SCRIPT, 14, 7);
      expect(lines.slice(5, 16)).toEqual(['Loose.', '', 'INT. TWO - DAY', '', 'Two.', '', 'INT. ONE - DAY', '', 'BOB', 'Hi.', '']);
      expect(lines[16]).toBe('CUT TO:');
      expect(parse(lines.join('\n')).lines[16].type).toBe('transition');
    });

    it('moves a card with everything it holds', () => {
      const { lines, focus } = moveOutlineBlock(SCRIPT, 22, 2);
      expect(lines[focus]).toBe('# B');
      expect(lines.slice(0, 7)).toEqual(['Title: T', '', '# B', '', 'INT. FOUR - DAY', '', '# A']);
      expect(lines.length).toBe(SCRIPT.length);
      expect(outlineCards(parse(lines.join('\n'))).map((c) => c.text)).toEqual(['B', 'A']);
    });

    it('moves the first card below the last and reports where it went', () => {
      const { lines, focus } = moveOutlineBlock(SCRIPT, 2, SCRIPT.length);
      expect(lines[focus]).toBe('# A');
      expect(lines[lines.length - 1]).toBe('INT. THREE - DAY');
      expect(lines.slice(0, 3)).toEqual(['Title: T', '', '# B']);
    });

    it('moves a sub-header into another header', () => {
      const lines = movedTo(SCRIPT, 18, SCRIPT.length);
      const [a, b] = outlineCards(parse(lines.join('\n')));
      expect(a.children.some((c) => c.kind === 'section')).toBe(false);
      expect(b.children.map((c) => c.text)).toEqual(['INT. FOUR - DAY', 'S']);
    });

    it('moves a card with its synopses', () => {
      const script = ['# A', '= a', '', '= apart', '', '# B', '= b'];
      const lines = movedTo(script, 5, 0);
      expect(lines).toEqual(['# B', '= b', '', '# A', '= a', '', '= apart']);
      expect(outlineCards(parse(lines.join('\n'))).map(synopses)).toEqual([['b'], ['a', 'apart']]);
    });

    it('adds the blank lines a scene needs, wherever it lands', () => {
      const lines = movedTo(['# A', 'Text.', '', '.SCENE', '', '# B', 'More.'], 3, 7);
      expect(lines).toEqual(['# A', 'Text.', '', '# B', 'More.', '', '.SCENE']);
      const plain = movedTo(['Action.', '', 'INT. X - DAY', '', 'Other.', '', 'INT. Y - DAY'], 6, 2);
      expect(parse(plain.join('\n')).lines[2].type).toBe('scene');
    });

    it('leaves the title page at the top', () => {
      const firstSlot = slotsFor(SCRIPT, 22)[0];
      expect(firstSlot.line).toBe(2);
      expect(parse(movedTo(SCRIPT, 22, firstSlot.line).join('\n')).titlePage).toHaveLength(1);
    });

    it('does nothing when it would stay in place', () => {
      expect(moveOutlineBlock(SCRIPT, 7, 7)).toBeNull();
      expect(moveOutlineBlock(SCRIPT, 7, 12)).toBeNull();
      expect(moveOutlineBlock(SCRIPT, 2, 10)).toBeNull();
    });

    it('will not split a comment that crosses into a block', () => {
      const script = ['Action.', '', '/* cut', '', '*/ # A', '', 'INT. X - DAY'];
      expect(moveOutlineBlock(script, 4, 0)).toBeNull();
    });

    it('moves a card above a synopsis, which stays joined and stays put', () => {
      const { lines, focus } = moveOutlineBlock(['# A', '= a', '', 'INT. X - DAY', '', 'Text.'], 3, 1);
      expect(lines).toEqual(['# A', '', 'INT. X - DAY', '', 'Text.', '= a']);
      expect(focus).toBe(2);
      const [act] = outlineCards(parse(lines.join('\n')));
      expect(act.children.map((c) => c.kind)).toEqual(['block', 'synopsis']);
    });

    it('keeps a bare scene heading a scene when a synopsis joins it', () => {
      const { lines } = moveOutlineBlock(['# A', '= a', '', 'INT. X - DAY'], 3, 1);
      expect(lines).toEqual(['# A', '', 'INT. X - DAY', '= a']);
      expect(parse(lines.join('\n')).lines[2].type).toBe('scene');
    });

    it('leaves a synopsis behind when the scene above it moves', () => {
      const script = ['# A', '', 'INT. X - DAY', '', 'Text.', '= a', '', 'INT. Y - DAY'];
      expect(moveOutlineBlock(script, 2, 8).lines).toEqual(['# A', '= a', '', 'INT. Y - DAY', '', 'INT. X - DAY', '', 'Text.']);
    });

    it('moves a synopsis alone, leaving what follows it', () => {
      const script = ['# A', '= a', '= b', '', 'Loose.', '', 'INT. X - DAY', '', 'Text.'];
      const down = moveOutlineBlock(script, 1, 9);
      expect(down.lines).toEqual(['# A', '= b', '', 'Loose.', '', 'INT. X - DAY', '', 'Text.', '= a']);
      expect(down.focus).toBe(8);
    });

    it('moves a synopsis between acts, joined to the line above', () => {
      const lines = movedTo(['# A', '= a', '', '# B'], 1, 4);
      expect(lines).toEqual(['# A', '', '# B', '= a']);
      expect(outlineCards(parse(lines.join('\n'))).map(synopses)).toEqual([[], ['a']]);
    });

    it('offers a synopsis the top level, above the first act', () => {
      const script = ['INT. X - DAY', '', '# A', '= a'];
      expect(slotsFor(script, 3).map((s) => [s.line, s.parent])).toEqual([[0, null], [2, null], [4, 2]]);
      expect(movedTo(script, 3, 0)).toEqual(['= a', '', 'INT. X - DAY', '', '# A']);
      expect(cards(movedTo(script, 3, 0)).map((c) => c.kind)).toEqual(['synopsis', 'block', 'section']);
    });

    it('keeps a synopsis apart from the title page', () => {
      const lines = movedTo(['Title: T', '', '# A', '= a'], 3, 2);
      expect(lines).toEqual(['Title: T', '', '= a', '', '# A']);
      expect(parse(lines.join('\n')).titlePage).toHaveLength(1);
    });

    it('offers a sequence the top level, above the first act', () => {
      const lines = movedTo(SCRIPT, 18, 2);
      expect(lines.slice(0, 5)).toEqual(['Title: T', '', '## S', '', 'INT. THREE - DAY']);
      expect(outlineCards(parse(lines.join('\n'))).map((c) => [c.level, c.text])).toEqual([[2, 'S'], [1, 'A'], [1, 'B']]);
    });

    it('offers new blocks the same places as ones that are there', () => {
      const cardsOf = outlineCards(parse(SCRIPT.join('\n')));
      const places = (moving) => outlineSlots(cardsOf, SCRIPT.length, moving).map((s) => s.line);
      expect(places({ kind: 'section', level: 1 })).toEqual([2, 22, 25]);
      expect(places({ kind: 'section', level: 2 })).toEqual([2, 3, 7, 14, 18, 22, 24, 25]);
      expect(places({ kind: 'synopsis' })).toEqual([2, 3, 7, 14, 18, 20, 22, 24, 25]);
      expect(outlineSlots([], 1, { kind: 'synopsis' })).toEqual([{ line: 1, before: null, parent: null }]);
    });

    it('offers scenes only the places they would stay', () => {
      const slots = slotsFor(SCRIPT, 7);
      // Above A, among A's own, into S, and into B: never below S while still inside A.
      expect(slots.map((s) => [s.line, s.parent])).toEqual([[2, null], [3, 2], [14, 2], [18, 2], [20, 18], [22, 18], [24, 22], [25, 22]]);
    });

    it('offers headers only places at their own level', () => {
      expect(slotsFor(SCRIPT, 22).map((s) => [s.line, s.parent])).toEqual([[2, null], [25, null]]);
      expect(slotsFor(SCRIPT, 18).map((s) => [s.line, s.parent])).toEqual([[2, null], [3, 2], [7, 2], [14, 2], [22, 2], [24, 22], [25, 22]]);
    });

    it('a sequence can go above scenes, which then become part of it', () => {
      const lines = movedTo(['# A', '', '.X', '', '## S', '', '.Y'], 4, 2);
      expect(lines).toEqual(['# A', '', '## S', '', '.Y', '', '.X']);
      const [seq] = sequences(cards(lines)[0]);
      expect(seq.children.map((c) => c.text)).toEqual(['Y', 'X']);
    });

    it('the bottom of an act with sequences is the end of its last one', () => {
      const script = ['# A', '', '.X', '', '## S', '', '.Y', '', '# B'];
      const last = slotsFor(script, 2).find((s) => s.parent === 4 && s.before === null);
      expect(movedTo(script, 2, last.line)).toEqual(['# A', '', '## S', '', '.Y', '', '.X', '', '# B']);
    });

    it('never offers a place inside the block being moved', () => {
      const lines = slotsFor(SCRIPT, 2).map((s) => s.line);
      expect(lines.every((at) => at <= 2 || at >= 22)).toBe(true);
    });

    it('every offered place keeps the block intact and the script whole', () => {
      for (const line of [2, 3, 7, 14, 18, 20, 22, 24]) {
        for (const slot of slotsFor(SCRIPT, line)) {
          const result = moveOutlineBlock(SCRIPT, line, slot.line);
          if (!result) continue;
          const parsed = parse(result.lines.join('\n'));
          expect(parsed.lines[result.focus].raw).toBe(SCRIPT[line]);
          expect(parsed.lines[result.focus].type).toBe(parse(SCRIPT.join('\n')).lines[line].type);
          expect(result.lines.filter(Boolean).sort()).toEqual(SCRIPT.filter(Boolean).sort());
          expect(parsed.titlePage).toHaveLength(1);
        }
      }
    });
  });

  it('adds a header at the end, with a blank line before it', () => {
    expect(addOutlineSection([''])).toEqual({ lines: ['#'], focus: 0 });
    expect(addOutlineSection(['Action.'])).toEqual({ lines: ['Action.', '', '#'], focus: 2 });
    expect(addOutlineSection(['Action.', ''])).toEqual({ lines: ['Action.', '', '#', ''], focus: 2 });
    expect(addOutlineSection([''], 2)).toEqual({ lines: ['##'], focus: 0 });
  });

  it('adds a header at the very top without a blank line above it', () => {
    expect(addOutlineSection(['.X'], 2, 0)).toEqual({ lines: ['##', '', '.X'], focus: 0 });
  });

  it('keeps a title page intact when adding the first header', () => {
    const { lines } = addOutlineSection(['Title: A', 'Author: B']);
    const parsed = parse(lines.join('\n'));
    expect(parsed.titlePage).toHaveLength(2);
    expect(parsed.lines[lines.length - 1].type).toBe('section');
  });

  it('adds a sequence at the step it was asked for', () => {
    const { lines, focus } = addOutlineSection(['# A', '= s', '', 'Action.', '', '## B', '', '# C'], 2, 7);
    expect(lines).toEqual(['# A', '= s', '', 'Action.', '', '## B', '', '##', '', '# C']);
    expect(focus).toBe(7);
    expect(addOutlineSection(['# A'], 2, 1).lines).toEqual(['# A', '', '##']);
    expect(addOutlineSection(['# A', '# B'], 2, 1).lines).toEqual(['# A', '', '##', '', '# B']);
    expect(addOutlineSection(['# A', '', '.X', '', '.Y'], 2, 4).lines).toEqual(['# A', '', '.X', '', '##', '', '.Y']);
  });

  it('a new sequence takes a synopsis right below it', () => {
    const { lines } = addOutlineSection(['# A', '', 'Text.', '= s'], 2, 3);
    expect(lines).toEqual(['# A', '', 'Text.', '', '##', '= s']);
    expect(synopses(sequences(cards(lines)[0])[0])).toEqual(['s']);
  });

  it('adds an act between two others with the same blank lines', () => {
    const { lines, focus } = addOutlineSection(['# A', '', '.X', '', '# B'], 1, 4);
    expect(lines).toEqual(['# A', '', '.X', '', '#', '', '# B']);
    expect(focus).toBe(4);
  });

  it('adds a synopsis at the step it was asked for, joined to what is above', () => {
    expect(addOutlineSynopsis(['# A', '= s', '', 'Action.'], 3)).toEqual({ lines: ['# A', '= s', '=', '', 'Action.'], focus: 2 });
    expect(addOutlineSynopsis(['# A', '', '.X', '', 'Text.', '', '.Y'], 6)).toEqual({ lines: ['# A', '', '.X', '', 'Text.', '=', '', '.Y'], focus: 5 });
    const [act] = cards(['# A', '', '.X', '=', '', '.Y']);
    expect(act.children.map((c) => c.kind)).toEqual(['block', 'synopsis', 'block']);
  });

  it('adds a synopsis anywhere, keeping what is around it what it was', () => {
    expect(addOutlineSynopsis([''])).toEqual({ lines: ['='], focus: 0 });
    expect(addOutlineSynopsis(['INT. X - DAY'], 0)).toEqual({ lines: ['=', '', 'INT. X - DAY'], focus: 0 });
    expect(addOutlineSynopsis(['Title: T', '', '# A'], 2)).toEqual({ lines: ['Title: T', '', '=', '', '# A'], focus: 2 });
    expect(synopses(cards(addOutlineSynopsis(['# A', '', '= apart']).lines)[0])).toEqual(['apart', '']);
  });

  it('rewrites card text without disturbing markers or comments', () => {
    expect(setOutlineText(['#'], 0, 'New')).toEqual(['# New']);
    expect(setOutlineText(['=old'], 0, 'New')).toEqual(['= New']);
    expect(setOutlineText(['## Old [[keep]]'], 0, 'New')).toEqual(['## New [[keep]]']);
    expect(setOutlineText(['# Old'], 0, '')).toEqual(['#']);
    expect(setOutlineText(['# Old'], 0, 'one\ntwo')).toEqual(['# one two']);
    expect(setOutlineText(['= Old'], 0, '===')).toEqual(['= ===']);
    expect(parse('= ===').lines[0].type).toBe('synopsis');
  });

  it('does not build up spaces while typing', () => {
    let lines = setOutlineText(['#'], 0, 'Foo ');
    expect(lines).toEqual(['# Foo ']);
    lines = setOutlineText(lines, 0, 'Foo b');
    expect(lines).toEqual(['# Foo b']);
  });

  it('removing a header takes its sub-headers and leaves everything else in the script', () => {
    const script = ['# A', '= a', '', '## B', '= b', '', 'INT. X - DAY', '', 'BOB', 'Hi.', '', '# C', '', 'Action.'];
    const lines = removeOutlineCard(script, 0);
    expect(lines).toEqual(['= a', '', '= b', '', 'INT. X - DAY', '', 'BOB', 'Hi.', '', '# C', '', 'Action.']);
    const parsed = parse(lines.join('\n'));
    expect(outlineCards(parsed).map((c) => [c.kind, c.text])).toEqual([['synopsis', 'a'], ['synopsis', 'b'], ['block', 'INT. X - DAY'], ['section', 'C']]);
    expect(parsed.lines[4].type).toBe('scene');
    expect(parsed.lines[6].type).toBe('character');
  });

  it('removing a sub-header leaves its parent and siblings', () => {
    expect(removeOutlineCard(['# A', '', '## B', '', '## C'], 2)).toEqual(['# A', '', '## C']);
  });

  it('a synopsis left by a removed act joins the card above it', () => {
    const blankBetween = removeOutlineCard(['# A', '= a', '', '# B', '= b'], 3);
    expect(blankBetween).toEqual(['# A', '= a', '', '= b']);
    expect(synopses(cards(blankBetween)[0])).toEqual(['a', 'b']);
    const first = removeOutlineCard(['# A', '= a', '', '# B'], 0);
    expect(cards(first).map((c) => c.kind)).toEqual(['synopsis', 'section']);
  });

  it('removing keeps comments, which may run on to other lines', () => {
    expect(removeOutlineCard(['# A [[keep]]', '', 'Action.'], 0)).toEqual(['[[keep]]', '', 'Action.']);
    expect(parse(removeOutlineCard(['# A /* open', 'cut', '*/ after'], 0).join('\n')).comments[0].type).toBe('boneyard');
  });

  it('removing the only header leaves a valid empty script', () => {
    expect(removeOutlineCard(['#'], 0)).toEqual(['']);
  });

  it('removing a synopsis deletes that line and nothing else', () => {
    expect(removeOutlineSynopsis(['# A', '= a', '= b', '', 'Action.'], 1)).toEqual(['# A', '= b', '', 'Action.']);
  });

  it('nothing it adds ever prints', () => {
    const withHeader = setOutlineText(addOutlineSection(['Action.']).lines, 2, 'Secret');
    const { lines } = addOutlineSynopsis(addOutlineSection(withHeader, 2, 3).lines, 3);
    const printed = layout(parse(setOutlineText(lines, 3, 'Hidden').join('\n'))).pages.flatMap(pageText).join('\n');
    expect(printed).toContain('Action.');
    expect(printed).not.toMatch(/Secret|Hidden|#|=/);
  });
});

describe('settings', () => {
  it('reads named and custom page sizes', () => {
    expect(parseDimensions('US Letter')).toBe('letter');
    expect(parseDimensions('letter')).toBe('letter');
    expect(parseDimensions(' a4 ')).toBe('a4');
    expect(parseDimensions('8in x 10in')).toEqual({ width: 8, height: 10, unit: 'in' });
    expect(parseDimensions('8" x 10"')).toEqual({ width: 8, height: 10, unit: 'in' });
    expect(parseDimensions('8.5 X 14')).toEqual({ width: 8.5, height: 14, unit: 'in' });
    expect(parseDimensions('21cm x 29.7cm')).toEqual({ width: 21, height: 29.7, unit: 'cm' });
    expect(parseDimensions('210 x 297 mm')).toEqual({ width: 210, height: 297, unit: 'mm' });
    expect(parseDimensions('8in x 25.4cm')).toEqual({ width: 8, height: 10, unit: 'in' });
    expect(parseDimensions('legal')).toBe(null);
    expect(parseDimensions('')).toBe(null);
  });
  it('keeps custom sizes wide enough for the script columns', () => {
    expect(parseDimensions('4" x 3"')).toEqual({ width: 7.5, height: 6, unit: 'in' });
    expect(parseDimensions('40in x 40in')).toEqual({ width: 17, height: 17, unit: 'in' });
    expect(parseDimensions('10cm x 10cm')).toEqual({ width: 19.05, height: 15.24, unit: 'cm' });
  });
  it('names sizes the way the Settings block writes them', () => {
    expect(formatDimensions('letter')).toBe('US Letter');
    expect(formatDimensions('a4')).toBe('A4');
    expect(formatDimensions({ width: 8, height: 10.5 })).toBe('8in x 10.5in');
    expect(formatDimensions({ width: 210, height: 297, unit: 'mm' })).toBe('210mm x 297mm');
  });
  it('gives a custom size the margins of US Letter', () => {
    const letter = pageProfile('letter');
    const custom = pageProfile({ width: 8.5, height: 11 });
    expect([custom.linesPerPage, custom.actionWidth]).toEqual([letter.linesPerPage, letter.actionWidth]);
    const metric = pageProfile('21.59cm x 27.94cm');
    expect([metric.linesPerPage, metric.actionWidth]).toEqual([letter.linesPerPage, letter.actionWidth]);
    expect(pageProfile('nonsense')).toBe(letter);
  });
  const S = '/*\nSettings:\n    Dimensions: A4\n*/';
  it('reads the Settings boneyard, wherever it is', () => {
    const p = parse('Title: BIG\n/*\nSettings:\n    Dimensions: A4\n    Other: x\n*/\n\nAction.');
    expect(p.settings).toEqual({ dimensions: 'A4', other: 'x' });
    expect(p.titlePage.map((e) => e.key)).toEqual(['title']);
    expect(p.lines[7].type).toBe('action');
    expect(p.settingsBlock.whole).toBe(true);
    expect(parse('/* Settings: Dimensions: 8in x 10in */\n\nAction.').settings).toEqual({ dimensions: '8in x 10in' });
    expect(parse('Action.\n\n/* cut */\n\n/*\nsettings:\n  dimensions: a4\n*/').settings).toEqual({ dimensions: 'a4' });
    expect(parse('Action. /* Settings: Dimensions: A4 */').settingsBlock.whole).toBe(false);
    expect(parse('Action.\n\n/* Some notes:\n  Dimensions: A4 */').settings).toEqual({});
    expect(parse('Action.').settings).toEqual({});
  });
  it('picks the size to lay out: an override, then the script, then the default', () => {
    const p = parse(`${S}\n\nAction.`);
    expect(resolvePaper(p, { paper: 'letter' })).toBe('a4');
    expect(resolvePaper(p, { paper: 'letter', paperOverride: 'letter' })).toBe('letter');
    expect(resolvePaper(parse('Action.'), { paper: 'a4' })).toBe('a4');
    expect(layout(p, { paper: 'letter' }).profile.paper).toBe('a4');
  });
  it('makes no title page from settings alone, and never prints them', () => {
    expect(layout(parse(`${S}\n\nAction.`)).pages.map((pg) => pg.kind)).toEqual(['script']);
    const titled = layout(parse(`Title: BIG\nContact:\n    me\n${S}\n\nAction.`));
    expect(titled.pages[0].kind).toBe('title');
    expect(pageText(titled.pages[0]).join('\n')).toMatch(/me/);
    expect(titled.pages.map(pageText).join('\n')).not.toMatch(/Settings|Dimensions|A4/);
  });
  it('writes a setting into the script', () => {
    const write = (src, value = 'A4') => writeSetting(parse(src), 'Dimensions', value).join('\n');
    expect(write('Action.')).toBe(`${S}\n\nAction.`);
    expect(write('')).toBe(`${S}\n`);
    expect(write('\nAction.')).toBe(`${S}\n\nAction.`);
    expect(write('Title: BIG\n\nAction.')).toBe(`Title: BIG\n${S}\n\nAction.`);
    expect(write('Title: BIG\nContact:\n    me')).toBe(`Title: BIG\nContact:\n    me\n${S}`);
    expect(write(`Title: BIG\n/*\nSettings:\n\tdimensions: letter\n*/\n\nAction.`, '8in x 10in')).toBe('Title: BIG\n/*\nSettings:\n\tdimensions: 8in x 10in\n*/\n\nAction.');
    expect(write('/*\nSettings:\n  Other: x\n*/')).toBe('/*\nSettings:\n  Other: x\n  Dimensions: A4\n*/');
    expect(write('/* Settings: Dimensions: letter */\n\nAction.')).toBe(`${S}\n\nAction.`);
  });
});

describe('layout', () => {
  const dialogue = (n) => `\nBOB\n${Array.from({ length: n }, (_, i) => `Line number ${i} of speech.`).join('\n')}\n`;

  it('positions elements per afterwriting metrics', () => {
    const rows = layout(parse('\nINT. A\n\nAction.\n\nBOB\n(soft)\nHi.\n\n> CUT TO:\n')).pages[0].rows.filter((r) => r.cells.length);
    expect(rows.map((r) => r.cells[0].x)).toEqual([15, 15, 35, 30, 25, 76 - 'CUT TO:'.length]);
  });
  it('uppercases unforced scene headings only', () => {
    expect(pageText(layout(parse('\n.forced\n')).pages[0])[0]).toBe('forced');
    expect(pageText(layout(parse('\nint. a - day\n')).pages[0])[0]).toBe('INT. A - DAY');
  });
  it('wraps to column width without losing text or style', () => {
    const rows = wrapRuns([{ text: 'aaa bbb ', bold: true }, { text: 'ccc ddd' }], 7);
    expect(rows.map((r) => r.map((x) => x.text).join(''))).toEqual(['aaa bbb', 'ccc ddd']);
    expect(rows[0][0].bold).toBe(true);
    expect(wrapRuns([{ text: 'x'.repeat(10) }], 4).map((r) => r[0].text)).toEqual(['xxxx', 'xxxx', 'xx']);
  });
  it('fills pages to the line limit', () => {
    const src = Array.from({ length: 200 }, (_, i) => `Action ${i}.\n`).join('\n');
    const { pages, profile } = layout(parse(src));
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.rows.length).toBeLessThanOrEqual(profile.linesPerPage);
    expect(pages[1].rows[0].cells.length).toBeGreaterThan(0);
  });
  it('splits long dialogue with MORE and CONTD', () => {
    const { pages } = layout(parse(dialogue(80)));
    const first = pageText(pages[0]);
    const second = pageText(pages[1]);
    expect(first.at(-1)).toBe('(MORE)');
    expect(second[0]).toBe("BOB (CONT'D)");
  });
  it('keeps every spoken line through a dialogue split', () => {
    const all = layout(parse(dialogue(150))).pages.flatMap(pageText).filter((t) => t.startsWith('Line number'));
    expect(all).toHaveLength(150);
  });
  it('never strands a scene heading at the foot of a page', () => {
    const filler = Array.from({ length: 53 }, (_, i) => `Filler ${i}`).join('\n');
    const { pages } = layout(parse(`${filler}\n\nINT. X - DAY\n\nAction after.`));
    expect(pageText(pages[0]).join()).not.toContain('INT. X');
    expect(pageText(pages[1])[0]).toBe('INT. X - DAY');
  });
  it('does not split a parenthetical from what it introduces', () => {
    const speech = Array.from({ length: 53 }, () => 'Words.').join('\n');
    const { pages } = layout(parse(`\nBOB\n${speech}\n(aside)\nMore words.\nAnd more.\nAnd more again.`));
    expect(pages.length).toBe(2);
    expect(pageText(pages[0]).at(-2)).not.toBe('(aside)');
  });
  describe('at every page-fill level', () => {
    const LIMIT = { letter: 55, a4: 57 };
    const filler = (n) => Array.from({ length: n }, (_, i) => `Filler ${i}.`).join('\n');
    const speech = (n) => Array.from({ length: n }, (_, i) => `Spoken ${i}.`).join('\n');
    const followups = {
      dialogue: `BOB\n${speech(6)}`,
      'long dialogue': `BOB\n${speech(130)}`,
      parenthetical: `BOB\n(aside)\n${speech(4)}\n(again)\n${speech(4)}`,
      scene: 'INT. ROOM - DAY\n\nAfter the heading.',
      action: filler(9).replaceAll('Filler', 'Later'),
      dual: `BOB\n${speech(4)}\n\nAMY ^\n${speech(4).replaceAll('Spoken', 'Answer')}`,
    };
    for (const paper of ['letter', 'a4']) {
      for (const [name, block] of Object.entries(followups)) {
        it(`${paper}: ${name} stays within the page and loses nothing`, () => {
          for (let n = 1; n <= LIMIT[paper] + 3; n++) {
            const source = `${filler(n)}\n\n${block}`;
            const { pages } = layout(parse(source), { paper });
            const printed = pages.flatMap((p) => p.rows.flatMap((r) => r.cells.map((c) => c.runs.map((x) => x.text).join(''))));
            for (const p of pages) expect(p.rows.length, `filler ${n}`).toBeLessThanOrEqual(LIMIT[paper]);
            for (const p of pages) expect(p.rows.map((r) => r.y), `filler ${n}`).toEqual(p.rows.map((_, i) => i));
            const expected = source.split('\n').filter((l) => /^(Filler|Later|Spoken|Answer|After)/.test(l));
            const got = printed.filter((t) => /^(Filler|Later|Spoken|Answer|After)/.test(t));
            expect(got.length, `filler ${n}`).toBe(expected.length);
            expect([...got].sort(), `filler ${n}`).toEqual([...expected].sort());
          }
        });
      }
    }
    it('(MORE) and a split speech never leave a parenthetical stranded', () => {
      for (let n = 1; n <= 58; n++) {
        const { pages } = layout(parse(`${filler(n)}\n\nBOB\n(aside)\n${speech(10)}\n(again)\n${speech(10)}`));
        for (const p of pages) {
          const types = p.rows.map((r) => r.type);
          const more = types.indexOf('more');
          if (more > 0) expect(types[more - 1], `filler ${n}`).toBe('dialogue');
          expect(types.at(-1), `filler ${n}`).not.toBe('character');
          expect(types.at(-1), `filler ${n}`).not.toBe('parenthetical');
        }
      }
    });
  });
  describe('scene continuation', () => {
    const body = (n) => Array.from({ length: n }, (_, i) => `Beat ${i}.`).join('\n');
    const on = { sceneContinued: true };
    const texts = (page) => page.rows.map((r) => r.cells.map((c) => c.runs.map((x) => x.text).join('')).join('|'));

    it('is off by default', () => {
      const printed = layout(parse(`INT. A - DAY\n\n${body(130)}`)).pages.flatMap(texts).join('\n');
      expect(printed).not.toContain('CONTINUED');
    });
    it('marks the foot and the top of each page a scene runs across, counting from the second', () => {
      const { pages, profile } = layout(parse(`INT. A - DAY\n\n${body(130)}`), on);
      expect(pages).toHaveLength(3);
      expect(texts(pages[0]).at(-1)).toBe('(CONTINUED)');
      expect(pages[0].rows.at(-1).y).toBe(profile.linesPerPage - 1);
      expect(pages[0].rows.at(-1).cells[0].x + '(CONTINUED)'.length).toBe(15 + profile.actionWidth);
      expect(texts(pages[1])[0]).toBe('CONTINUED:');
      expect(pages[1].rows[1].cells).toEqual([]);
      expect(texts(pages[2])[0]).toBe('CONTINUED: (2)');
      expect(texts(pages[2]).at(-1)).not.toBe('(CONTINUED)');
    });
    it('repeats the scene number', () => {
      const { pages } = layout(parse(`INT. A - DAY #7A#\n\n${body(70)}`), on);
      expect(texts(pages[1])[0]).toBe('7A|CONTINUED:|7A');
      expect(texts(layout(parse(`INT. A - DAY #7A#\n\n${body(70)}`), { ...on, sceneNumbers: false }).pages[1])[0]).toBe('CONTINUED:');
    });
    it('does not mark a page that opens on a new scene', () => {
      const { pages } = layout(parse(`INT. A - DAY\n\n${body(49)}\n\nINT. B - DAY\n\n${body(5)}`), on);
      expect(texts(pages[1])[0]).toBe('INT. B - DAY');
      expect(texts(pages[0]).join()).not.toContain('CONTINUED');
    });
    it('does not mark text before the first scene', () => {
      expect(layout(parse(body(70)), on).pages.flatMap(texts).join()).not.toContain('CONTINUED');
    });
    it('does not mark a forced page break, but resumes afterwards', () => {
      const { pages } = layout(parse(`INT. A - DAY\n\nOne.\n\n===\n\n${body(70)}`), on);
      expect(texts(pages[1])[0]).toBe('Beat 0.');
      expect(texts(pages[0]).join()).not.toContain('CONTINUED');
      expect(texts(pages[2])[0]).toBe('CONTINUED:');
    });
    it('sits above a speech carried over with MORE', () => {
      const { pages } = layout(parse(`INT. A - DAY\n\nBOB\n${body(70)}`), on);
      expect(texts(pages[0]).slice(-2)).toEqual(['(MORE)', '(CONTINUED)']);
      expect(texts(pages[1]).slice(0, 3)).toEqual(['CONTINUED:', '', "BOB (CONT'D)"]);
    });
    it('reports continued pages to the editor', () => {
      expect(layout(parse(`INT. A - DAY\n\n${body(70)}`), on).pageStarts[0].continued).toBe(true);
      expect(layout(parse(`INT. A - DAY\n\n${body(70)}`)).pageStarts[0].continued).toBe(false);
    });
    it('stays on the page and loses nothing at every fill level', () => {
      const blocks = [`BOB\n${body(130)}`, 'INT. B - DAY\n\nAfter.', body(9), `BOB\nHi.\nThere.\n\nAMY ^\nHey.\nYou.`, `BOB\n(aside)\n${body(4)}\n(again)\n${body(4)}`];
      for (const paper of ['letter', 'a4']) {
        const limit = paper === 'letter' ? 55 : 57;
        for (const block of blocks) {
          for (let n = 1; n <= limit + 3; n++) {
            const source = `INT. A - DAY\n\n${Array.from({ length: n }, (_, i) => `Fill ${i}.`).join('\n')}\n\n${block}`;
            const { pages } = layout(parse(source), { ...on, paper });
            for (const p of pages) {
              expect(p.rows.length).toBeLessThanOrEqual(limit);
              expect(Math.max(...p.rows.map((r) => r.y))).toBeLessThan(limit);
              expect(new Set(p.rows.map((r) => r.y)).size).toBe(p.rows.length);
            }
            const wanted = /^(Fill|Beat|After|Hi|There|Hey|You)/;
            const got = pages.flatMap((p) => p.rows.flatMap((r) => r.cells.map((c) => c.runs.map((x) => x.text).join('')))).filter((t) => wanted.test(t));
            expect(got.sort()).toEqual(source.split('\n').filter((l) => wanted.test(l)).sort());
          }
        }
      }
    });
    it('cannot hang on a block longer than a page', () => {
      const { pages } = layout(parse(`INT. A - DAY\n\nBOB\n${body(30)}\n\nAMY ^\n${body(200)}`), on);
      expect(pages.length).toBeGreaterThan(3);
    });
  });
  it('honors forced page breaks', () => {
    const { pages } = layout(parse('One.\n\n===\n\nTwo.'));
    expect(pages.map(pageText)).toEqual([['One.'], ['Two.']]);
  });
  it('lays dual dialogue side by side', () => {
    const { pages } = layout(parse('\nBOB\nHi.\n\nAMY ^\nHey.\n'));
    const rows = pages[0].rows.filter((r) => r.cells.length);
    expect(rows[0].cells.map((c) => c.runs[0].text)).toEqual(['BOB', 'AMY']);
    expect(rows[1].cells.map((c) => c.runs[0].text)).toEqual(['Hi.', 'Hey.']);
    expect(rows[0].cells[0].x).toBeLessThan(rows[0].cells[1].x);
    expect(rows).toHaveLength(2);
  });
  it('builds a title page that can be turned off', () => {
    const p = parse('Title: BIG\nAuthor: Me\nContact: a@b.c\n\nAction.');
    const on = layout(p);
    expect(on.pages[0].kind).toBe('title');
    expect(on.pages[1].number).toBe(1);
    expect(layout(p, { titlePage: false }).pages[0].kind).toBe('script');
  });
  it('attaches notes to rows but keeps them out of the text', () => {
    const { pages } = layout(parse('[[standalone]]\nAction [[inline]] text.\n\nBOB [[cue]]\nHi.'));
    const rows = pages[0].rows;
    expect(rows[0].notes.map((n) => n.text)).toEqual(['standalone', 'inline']);
    expect(pageText(pages[0]).join()).not.toMatch(/standalone|inline|cue/);
    expect(rows.flatMap((r) => r.notes).map((n) => n.text)).toContain('cue');
  });
  it('excludes boneyard from output', () => {
    const { pages } = layout(parse('Keep.\n\n/* drop */\n\nAlso keep.'));
    expect(pageText(pages[0]).join()).not.toContain('drop');
    expect(pages[0].rows.flatMap((r) => r.notes)).toEqual([]);
  });
  it('reports page starts for the editor', () => {
    const src = Array.from({ length: 60 }, (_, i) => `A${i}`).join('\n');
    expect(layout(parse(src)).pageStarts[0].number).toBe(2);
  });
  describe('page starts keep unprinted lines with the page they introduce', () => {
    const lineOf = (source, text) => source.split('\n').findIndex((l) => l.includes(text));
    const fill = (n) => Array.from({ length: n }, (_, i) => `Fill ${i}.`).join('\n');
    const startOf = (source) => layout(parse(source)).pageStarts[0].line;

    it('after a forced break, starts at the first section', () => {
      const source = 'One.\n\n===\n\n# Act Two\n= Summary.\n\n## The Storm\n\nINT. A - DAY\n\nAction.';
      expect(startOf(source)).toBe(lineOf(source, '# Act Two'));
    });
    it('at a natural break, brings the headings over too', () => {
      const source = `${fill(54)}\n\n## Night\n\n= Summary.\n\nINT. B - DAY\n\nAction.`;
      expect(startOf(source)).toBe(lineOf(source, '## Night'));
    });
    it('brings a leading note over too', () => {
      const source = `${fill(54)}\n\n[[check this]]\n\nINT. B - DAY\n\nAction.`;
      expect(startOf(source)).toBe(lineOf(source, 'check this'));
    });
    it('stops at the last printed line, leaving it on the old page', () => {
      const source = 'One.\n\n===\nTwo.';
      expect(startOf(source)).toBe(lineOf(source, 'Two.'));
    });
    it('does not move a page that has nothing leading into it', () => {
      const source = `${fill(54)}\n\nINT. B - DAY\n\nAction.`;
      expect(startOf(source)).toBe(lineOf(source, 'INT. B'));
    });
    it('does not move a break inside a speech', () => {
      const source = `\nBOB\n${fill(70)}`;
      expect(parse(source).lines[startOf(source)].type).toBe('dialogue');
    });
  });
  it('places each title line where it prints, for the editor to match', () => {
    const parsed = parse('Title: BIG\nAuthor: Me\nContact:\n    a@b.c\nNotes: Hi\n\nAction.');
    const positions = titlePositions(parsed);
    const printed = layout(parsed).pages[0].rows;
    for (const [line, y] of positions) expect(printed.find((r) => r.line === line).y).toBe(y);
    expect(positions.get(0)).toBe(15);
    expect(positions.get(3)).toBe(54);
    expect(titlePositions(parsed, { titlePage: false }).size).toBe(0);
    expect(titlePositions(parse('Action.')).size).toBe(0);
    expect(titlePositions(parsed, { paper: 'a4' }).get(3)).toBe(56);
  });
  it('reports the start of page 1 only when a title page comes before it', () => {
    const titled = 'Title: BIG\n\n# Act One\n\nINT. A - DAY\n\nAction.';
    expect(layout(parse(titled)).pageStarts).toEqual([{ number: 1, line: 2, continued: false }]);
    expect(layout(parse(titled), { titlePage: false }).pageStarts).toEqual([]);
    expect(layout(parse('INT. A - DAY\n\nAction.')).pageStarts).toEqual([]);
  });
  it('handles an empty script', () => {
    const { pages } = layout(parse(''));
    expect(pages).toHaveLength(1);
    expect(pages[0].rows).toEqual([]);
  });
  it('supports A4', () => {
    expect(layout(parse('x'), { paper: 'a4' }).profile.linesPerPage).toBe(57);
  });
});

describe('ribbon line conversion', () => {
  const convert = (src, i, type) => applyLineType(src.split('\n'), i, i, type);
  const result = (src, i, type) => {
    const r = convert(src, i, type);
    return { text: r.lines.join('\n'), line: parse(r.lines.join('\n')).lines[r.cursor.line], cursor: r.cursor };
  };

  for (const type of ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'lyrics', 'transition', 'centered', 'section-1', 'section-2', 'synopsis', 'note']) {
    for (const [label, src, i] of [
      ['plain action', 'First.\n\nSome words here\n\nLast.', 2],
      ['cramped action', 'First\nSome words here\nLast', 1],
      ['dialogue', 'Top.\n\nBOB\nSome words here\n\nEnd.', 3],
      ['scene', 'Top.\n\nINT. HOUSE\n\nEnd.', 2],
      ['forced', 'Top.\n\n!Some words here\n\nEnd.', 2],
      ['last line', 'Top.\n\nSome words', 2],
    ]) {
      if (label === type) continue; // pressing the active type toggles it off, tested below
      it(`${label} -> ${type} really parses as ${type}`, () => {
        const r = convert(src, i, type);
        const parsed = parse(r.lines.join('\n')).lines;
        const target = parsed.find((l) => /Some words|HOUSE|words here/i.test(l.raw));
        if (type === 'note') expect(target.type).toBe('comment');
        else expect(lineTypeKey(target)).toBe(type);
      });
    }
  }
  it('adds no markers when the plain text already qualifies', () => {
    expect(result('INT. HOUSE\nnext', 0, 'scene').text).toBe('INT. HOUSE\n\nnext');
    expect(result('\nbob\nHi.', 1, 'character').text).toBe('\nBOB\nHi.');
  });
  it('forces only when needed', () => {
    expect(result('\nbob\n', 1, 'character').text).toBe('\n@BOB\n');
    expect(result('\nBOB\nHi', 1, 'action').text).toBe('\n!BOB\nHi');
  });
  it('pressing the active type returns the line to action', () => {
    expect(result('\n.THING\n', 1, 'scene').text).toBe('\nTHING\n');
    expect(result('# Act', 0, 'section-1').text).toBe('Act');
    expect(result('[[idea]]', 0, 'note').text).toBe('idea');
  });
  it('switches section levels', () => {
    expect(result('# Act', 0, 'section-2').text).toBe('## Act');
  });
  it('rejoins dialogue to the cue above a blank line', () => {
    expect(result('\nBOB\nHi\n\nThere', 4, 'dialogue').text).toBe('\nBOB\nHi\nThere');
  });
  it('adds a selected placeholder cue when there is no speaker', () => {
    const r = result('Words.', 0, 'dialogue');
    expect(r.text).toBe('\nCHARACTER\nWords.'.replace(/^\n/, ''));
    expect(r.cursor).toEqual({ line: 0, from: 0, to: 9 });
  });
  it('puts the cursor where typing should go on empty lines', () => {
    expect(result('', 0, 'scene').text).toBe('INT. ');
    expect(result('\n\n', 1, 'character').text).toBe('\n@\n');
    const paren = result('BOB\n', 1, 'parenthetical');
    expect(paren.text).toBe('BOB\n()');
    expect(paren.cursor.from).toBe(1);
    const center = result('', 0, 'centered');
    expect(center.text).toBe('>  <');
    expect(center.cursor.from).toBe(2);
  });
  it('preserves emphasis and notes through conversion', () => {
    expect(result('\n**big** [[n]]\n', 1, 'lyrics').text).toBe('\n~**big** [[n]]\n');
    expect(result('\nbob [[keep case]]\nHi', 1, 'character').text).toBe('\nBOB [[keep case]]\nHi');
  });
  it('converts a multi-line selection', () => {
    const r = applyLineType(['one', '', 'two'], 0, 2, 'lyrics');
    expect(r.lines).toEqual(['~one', '', '~two']);
  });
  it('inserts page breaks', () => {
    expect(insertPageBreak(['one', 'two'], 0).lines).toEqual(['one', '', '===', '', 'two']);
    expect(parse(insertPageBreak(['one'], 0).lines.join('\n')).lines.map((l) => l.type)).toContain('page-break');
  });
  it('toggles dual dialogue from anywhere in the block', () => {
    const on = toggleDual(['', 'BOB', 'Hi'], 2);
    expect(on.lines[1]).toBe('BOB ^');
    expect(toggleDual(on.lines, 1).lines[1]).toBe('BOB');
    expect(toggleDual(['action'], 0)).toBeNull();
  });
});

describe('boneyard', () => {
  const cut = (text, a, b, c, d) => toggleBoneyard(text.split('\n'), a, b, c, d);
  it('cuts the selection only', () => {
    const r = cut('keep this out', 0, 5, 0, 9);
    expect(r.lines).toEqual(['keep /* this */ out']);
    expect(r.cursor.from).toBe('keep /* this'.length);
  });
  it('cuts the whole line when nothing is selected', () => {
    expect(cut('  a line', 0, 3, 0, 3).lines).toEqual(['  /* a line */']);
  });
  it('wraps one comment across several lines', () => {
    const r = cut('one\ntwo\nthree', 0, 0, 2, 5);
    expect(r.lines).toEqual(['/* one', 'two', 'three */']);
    expect(parse(r.lines.join('\n')).comments.map((c) => c.type)).toEqual(['boneyard']);
  });
  it('restores from anywhere inside, including across lines', () => {
    expect(cut('keep /* this */ out', 0, 10, 0, 10).lines).toEqual(['keep this out']);
    expect(cut('/* one\ntwo\nthree */', 1, 1, 1, 1).lines).toEqual(['one', 'two', 'three']);
  });
  it('round trips', () => {
    const on = cut('a b c', 0, 2, 0, 3);
    expect(toggleBoneyard(on.lines, on.cursor.line, on.cursor.from, on.cursor.line, on.cursor.to).lines).toEqual(['a b c']);
  });
  it('gives an empty line somewhere to type', () => {
    const r = cut('', 0, 0, 0, 0);
    expect(r.lines).toEqual(['/*  */']);
    expect(r.cursor.from).toBe(3);
  });
  it('leaves notes alone', () => {
    expect(cut('a [[note]] b', 0, 3, 0, 3).lines).toEqual(['/* a [[note]] b */']);
    expect(parse('/* a [[note]] b */').comments.map((c) => c.type)).toEqual(['boneyard']);
  });
  it('reports its own line type, distinct from a note', () => {
    expect(lineTypeKey(parse('/* cut */').lines[0])).toBe('boneyard');
    expect(lineTypeKey(parse('[[note]]').lines[0])).toBe('note');
  });
  it('converts to another type without keeping the delimiters', () => {
    expect(applyLineType(['/* cut */'], 0, 0, 'note').lines).toEqual(['[[cut]]']);
    expect(applyLineType(['[[note]]'], 0, 0, 'lyrics').lines).toEqual(['~note']);
  });
});

describe('emphasis toggling', () => {
  it('wraps, trimming selection whitespace', () => {
    expect(toggleEmphasis('say hello now', 3, 10, 'bold')).toEqual({ text: 'say **hello** now', from: 6, to: 11 });
  });
  it('unwraps when the selection is inside', () => {
    expect(toggleEmphasis('say **hello** now', 6, 11, 'bold')).toEqual({ text: 'say hello now', from: 4, to: 9 });
    expect(toggleEmphasis('a *b* c', 3, 3, 'italic').text).toBe('a b c');
    expect(toggleEmphasis('a _b_ c', 3, 3, 'underline').text).toBe('a b c');
  });
  it('removes only one layer of a combined style', () => {
    expect(toggleEmphasis('***x***', 3, 4, 'bold').text).toBe('*x*');
    expect(toggleEmphasis('***x***', 3, 4, 'italic').text).toBe('**x**');
  });
  it('inserts an empty pair at the caret', () => {
    expect(toggleEmphasis('ab', 1, 1, 'bold')).toEqual({ text: 'a****b', from: 3, to: 3 });
  });
  it('stays inside the content range, away from prefix markers', () => {
    expect(toggleEmphasis('.scene', 0, 6, 'italic', 1).text).toBe('.*scene*');
  });
  it('reports active styles', () => {
    expect(emphasisAt('a **b** c', 4, 4)).toEqual({ bold: true, italic: false, underline: false });
    expect(emphasisAt('a [[**b**]] c', 6, 6).bold).toBe(false);
  });
  it('round trips', () => {
    const on = toggleEmphasis('word', 0, 4, 'underline');
    expect(toggleEmphasis(on.text, on.from, on.to, 'underline').text).toBe('word');
  });
});

describe('new script template', () => {
  const when = new Date(2026, 10, 3);
  const page = () => layout(parse(newScript(when))).pages[0];
  const printed = () => page().rows.map((r) => r.cells[0].runs.map((x) => x.text).join(''));

  it('is entirely a title page, with an empty line to start writing on', () => {
    const { lines, titlePage } = parse(newScript(when));
    expect(titlePage.map((e) => e.key)).toEqual(['title', 'credit', 'author', 'source', 'draft date', 'contact', 'copyright', 'notes']);
    expect(lines.at(-1).type).toBe('blank');
    expect(lines.slice(0, -2).every((l) => l.type === 'title')).toBe(true);
  });
  it('prints every field it offers, so nothing in it is a dead end', () => {
    expect(page().kind).toBe('title');
    expect(printed()).toEqual(expect.arrayContaining([
      'Untitled', 'Written by', 'Your Name', 'Based On Blank',
      'November 3, 2026', 'you@example.com', '555-555-5555', '(c) 2026 Your Name', 'First draft',
    ]));
  });
  it('still parses cleanly with any one field removed', () => {
    const lines = newScript(when).split('\n');
    for (const key of ['Title:', 'Credit:', 'Author:', 'Source:', 'Draft date:', 'Copyright:', 'Notes:']) {
      const without = lines.filter((l) => !l.startsWith(key)).join('\n');
      const { titlePage } = parse(`${without}Action.`);
      expect(titlePage.length, key).toBeGreaterThan(0);
      expect(titlePage.map((e) => `${e.label}:`)).not.toContain(key);
      expect(parse(`${without}Action.`).lines.at(-1).type, key).toBe('action');
    }
  });
});

describe('source fidelity', () => {
  it('parse keeps every line verbatim', () => {
    const sample = readFileSync(new URL('../../element/demo/sample.fountain', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(parse(sample).lines.map((l) => l.raw).join('\n')).toBe(sample);
  });
});

describe('pdf', () => {
  it('produces the same page count as the layout, at the right size', async () => {
    const src = readFileSync(new URL('../../element/demo/sample.fountain', import.meta.url), 'utf8');
    const { bytes, pageCount, unsupported } = await renderPdf(src);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(pageCount);
    expect(pageCount).toBe(layout(parse(src)).pages.length);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    expect(doc.getTitle()).toBeTruthy();
    expect(unsupported).toEqual([]);
  });
  it('prints a title page that ends in settings without them', async () => {
    const src = 'Title: BIG\nContact:\n    me\n/*\nSettings:\n    Dimensions: A4\n*/\n\nINT. HOUSE - DAY\n\nAction.';
    const { bytes, pageCount } = await renderPdf(src);
    const doc = await PDFDocument.load(bytes);
    expect(pageCount).toBe(2);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('BIG');
    expect(doc.getPage(1).getSize()).toEqual({ width: 8.27 * 72, height: 11.7 * 72 });
    const [cover, script] = layout(parse(src)).pages;
    const printed = (p) => pageText(p).join('\n');
    expect(printed(cover)).not.toMatch(/Settings|Dimensions|A4/);
    expect(printed(script)).toMatch(/^INT\. HOUSE - DAY/);
  });
  it("uses the script's page size unless the export names another", async () => {
    const src = '/*\nSettings:\n    Dimensions: 8in x 10in\n*/\n\nAction.';
    const size = async (options) => (await PDFDocument.load((await renderPdf(src, options)).bytes)).getPage(0).getSize();
    expect(await size()).toEqual({ width: 576, height: 720 });
    expect(await size({ paperOverride: 'a4' })).toEqual({ width: 8.27 * 72, height: 11.7 * 72 });
  });
  describe('with Courier Prime embedded', () => {
    const face = (name) => readFileSync(new URL(`../../../node_modules/@fontsource/courier-prime/files/courier-prime-latin-${name}.woff`, import.meta.url));
    const fonts = { regular: face('400-normal'), bold: face('700-normal'), italic: face('400-italic'), boldItalic: face('700-italic') };
    const fontNames = async (bytes) => {
      const doc = await PDFDocument.load(bytes);
      return doc.context.enumerateIndirectObjects()
        .map(([, object]) => /\/BaseFont \/(\S+)/.exec(object.toString())?.[1])
        .filter(Boolean);
    };

    it('uses it for each style that appears, and only those', async () => {
      const names = await fontNames((await renderPdf('Plain and **bold** text.', { fonts })).bytes);
      expect(names.some((n) => /CourierPrime-Regular/.test(n))).toBe(true);
      expect(names.some((n) => /CourierPrime-Bold/.test(n))).toBe(true);
      expect(names.some((n) => /Italic/.test(n))).toBe(false);
    });
    it('embeds font programs that are complete and that PDF readers can use', async () => {
      const doc = await PDFDocument.load((await renderPdf('Some **bold** text.', { fonts })).bytes);
      const programs = [];
      for (const [, object] of doc.context.enumerateIndirectObjects()) {
        if (!(object instanceof PDFDict)) continue;
        for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
          const ref = object.get(PDFName.of(key));
          if (ref) programs.push(Buffer.from(decodePDFRawStream(doc.context.lookup(ref)).decode()));
        }
      }
      expect(programs).toHaveLength(2);
      for (const program of programs) {
        expect(program.subarray(0, 4).toString('latin1')).not.toMatch(/^wOF/);
        const parsed = fontkit.create(program);
        expect(parsed.numGlyphs).toBeGreaterThan(1);
        // A rebuilt font that loses these tables opens in nothing, or shows blank text.
        for (const table of ['glyf', 'loca', 'head', 'hmtx']) expect(parsed.directory.tables[table], table).toBeTruthy();
        // Layout relies on every character being 0.6em wide.
        expect(parsed.getGlyph(1).advanceWidth / parsed.unitsPerEm).toBeCloseTo(0.6, 2);
      }
    });
    it('renders the whole sample with no characters lost', async () => {
      const src = readFileSync(new URL('../../element/demo/sample.fountain', import.meta.url), 'utf8');
      const { pageCount, unsupported, bytes } = await renderPdf(src, { fonts });
      expect(pageCount).toBe(layout(parse(src)).pages.length);
      expect(unsupported).toEqual([]);
      expect(await fontNames(bytes)).not.toContain('Courier');
    });
    it('keeps smart quotes and dashes in Courier Prime', async () => {
      const { unsupported, bytes } = await renderPdf('“Quote” — it’s fine…', { fonts });
      expect(unsupported).toEqual([]);
      expect(await fontNames(bytes)).not.toContain('Courier');
    });
    it('falls back to built-in Courier for accents it lacks, then reports the rest', async () => {
      const { unsupported, bytes } = await renderPdf('Plain Ž 日', { fonts });
      expect(unsupported).toEqual(['日']);
      const names = await fontNames(bytes);
      expect(names).toContain('Courier');
      expect(names.some((n) => n.includes('CourierPrime'))).toBe(true);
    });
  });
  it('supports A4 and reports characters Courier cannot draw', async () => {
    const { bytes, unsupported } = await renderPdf('Hello 日本', { paper: 'a4' });
    const { width } = (await PDFDocument.load(bytes)).getPage(0).getSize();
    expect(width).toBeCloseTo(595.44, 1);
    expect(unsupported).toEqual(['日', '本']);
  });
  it('keeps smart quotes and dashes', async () => {
    const { unsupported } = await renderPdf('“Quote” — it’s fine…');
    expect(unsupported).toEqual([]);
  });
});

describe('dualAt', () => {
  const lines = parse('Action.\n\nBOB\nHello.\n\nAMY ^\n(softly)\nHi.\nThere.\n\nMore action.').lines;

  it('is true on every line of a dual speech', () => {
    for (const index of [5, 6, 7, 8]) expect(dualAt(lines, index)).toBe(true);
  });

  it('is false on a normal speech and outside of speeches', () => {
    for (const index of [0, 1, 2, 3, 4, 9, 10]) expect(dualAt(lines, index)).toBe(false);
  });
});

describe('title page fields with values on the lines below', () => {
  const titled = (lines) => parse(lines.join('\n')).titlePage.map((e) => e.key);

  it('starts an indented value after a key with nothing beside it', () => {
    expect(continueTitleField(['Contact:'], 0)).toEqual({ lines: ['Contact:', '    '], cursor: { line: 1, from: 4 } });
    expect(continueTitleField(['Contact: '], 0).lines).toEqual(['Contact: ', '    ']);
  });
  it('keeps going at the same indent', () => {
    expect(continueTitleField(['Contact:', '   One'], 1)).toEqual({ lines: ['Contact:', '   One', '   '], cursor: { line: 2, from: 3 } });
    expect(continueTitleField(['Contact:', '\tOne'], 1).lines).toEqual(['Contact:', '\tOne', '\t']);
  });
  it('stops on a second Enter, leaving a blank line', () => {
    expect(continueTitleField(['Contact:', '    One', '    '], 2)).toEqual({ lines: ['Contact:', '    One', ''], cursor: { line: 2, from: 0 } });
  });
  it('stops without ending the title page when there are fields below', () => {
    const result = continueTitleField(['Contact:', '    ', 'Notes: N'], 1);
    expect(result).toEqual({ lines: ['Contact:', 'Notes: N'], cursor: { line: 1, from: 0 } });
    expect(titled(result.lines)).toEqual(['contact', 'notes']);
  });
  it('reads any indent of two or more spaces or a tab, as long as a key keeps to one', () => {
    for (const indent of ['  ', '   ', '    ', '     ', '\t']) {
      const { lines, titlePage } = parse(`Contact:\n${indent}One\n${indent}Two\nNotes: N\n${indent}More\n\nAction.`);
      expect(titlePage.map((e) => e.lines.length)).toEqual([3, 2]);
      expect(lines[1].text).toBe('One');
      expect(lines[1].contentStart).toBe(indent.length);
      expect(lines[6].type).toBe('action');
    }
  });
  it('lets each key choose its own indent', () => {
    expect(parse('Contact:\n  One\nNotes:\n\tTwo').titlePage.map((e) => e.lines.length)).toEqual([2, 2]);
  });
  it('a value out of step with its key ends the title page', () => {
    const { lines, titlePage } = parse('Contact:\n  One\n    Two\n\nAction.');
    expect(titlePage[0].lines).toEqual([0, 1]);
    expect(lines[2].type).toBe('action');
    expect(parse('Contact:\n\tOne\n  Two').titlePage[0].lines).toEqual([0, 1]);
  });
  it('one space is not an indent', () => {
    expect(parse('Contact:\n One').titlePage[0].lines).toEqual([0]);
  });
  it('a new value uses the indent already in use', () => {
    expect(continueTitleField(['Contact:', '  One'], 0).lines).toEqual(['Contact:', '  ', '  One']);
    expect(continueTitleField(['Title: T', 'Contact:', '     One', 'Notes:'], 3).lines).toEqual(['Title: T', 'Contact:', '     One', 'Notes:', '     ']);
    expect(continueTitleField(['Notes:', 'Contact:', '\tOne'], 0).lines[1]).toBe('\t');
  });
  it('an indent waiting for its value is part of the field it follows', () => {
    const parsed = parse('Contact:\n  \n\nAction.');
    expect(parsed.lines[1].type).toBe('title');
    expect(parsed.lines[1].titleKey).toBe('contact');
    expect(parsed.titlePage[0].lines).toEqual([0, 1]);
  });
  it('splits a value into two values', () => {
    expect(continueTitleField(['Contact:', '  OneTwo'], 1, 5)).toEqual({ lines: ['Contact:', '  One', '  Two'], cursor: { line: 2, from: 2 } });
  });
  it('Enter at the start of a value opens an empty value above it', () => {
    expect(continueTitleField(['Contact:', '  One'], 1, 2)).toEqual({ lines: ['Contact:', '  ', '  One'], cursor: { line: 2, from: 2 } });
    expect(continueTitleField(['Contact:', '  One'], 1, 0).lines).toEqual(['Contact:', '  ', '  One']);
  });
  it('Enter partway through a key does nothing special', () => {
    expect(continueTitleField(['Contact:'], 0, 3)).toBeNull();
  });
  it('Backspace at the start of a value joins it to the line above', () => {
    expect(joinTitleValue(['Contact:', '  One', '  Two'], 2)).toEqual({ lines: ['Contact:', '  OneTwo'], cursor: { line: 1, from: 5 } });
    expect(joinTitleValue(['Contact:', '  One', '  '], 2)).toEqual({ lines: ['Contact:', '  One'], cursor: { line: 1, from: 5 } });
    expect(joinTitleValue(['Contact:', '  '], 1)).toEqual({ lines: ['Contact:'], cursor: { line: 0, from: 8 } });
  });
  it('Backspace on a key\'s first value brings it beside the key', () => {
    expect(joinTitleValue(['Contact:', '  One'], 1)).toEqual({ lines: ['Contact: One'], cursor: { line: 0, from: 9 } });
  });
  it('leaves a value on the same line as its key alone', () => {
    expect(continueTitleField(['Title: Mine'], 0)).toBeNull();
  });
  it('leaves everything outside the title page alone', () => {
    expect(continueTitleField(['Action.'], 0)).toBeNull();
    expect(continueTitleField(['Title: A', '', '    Indented action.'], 2)).toBeNull();
    expect(continueTitleField(['Title: A', ''], 1)).toBeNull();
  });
  it('an indent waiting for its value keeps the fields below on the title page', () => {
    const { lines, titlePage } = parse('Contact:\n    \nNotes: N\n\nAction.');
    expect(titlePage.map((e) => e.key)).toEqual(['contact', 'notes']);
    expect(lines[1].type).toBe('title');
    expect(lines[4].type).toBe('action');
  });
  it('spaces before something else still end the title page', () => {
    const { lines, titlePage } = parse('Title: A\n    \nFADE IN:\n\nAction.');
    expect(titlePage.map((e) => e.key)).toEqual(['title']);
    expect(lines[1].type).toBe('blank');
  });
  it('an unfinished indent prints nothing extra', () => {
    const page = (src) => layout(parse(src)).pages[0].rows.filter((r) => r.cells.some((c) => c.runs.length)).map((r) => [r.y, r.cells[0].runs.map((x) => x.text).join('')]);
    expect(page('Title: A\nContact:\n    Me\n    \n\nAction.')).toEqual(page('Title: A\nContact:\n    Me\n\nAction.'));
  });
});

describe('scriptTitle', () => {
  it('reads a title beside its key', () => {
    expect(scriptTitle(parse('Title: Mine\nAuthor: Me'))).toBe('Mine');
  });
  it('joins a title on several lines with separators', () => {
    expect(scriptTitle(parse('Title:\n    One\n    Two\n    Three\nAuthor: Me'))).toBe('One · Two · Three');
    expect(scriptTitle(parse('Title: One\n    Two'))).toBe('One · Two');
  });
  it('can join them with another separator', () => {
    expect(scriptTitle(parse('Title:\n    One\n    Two'), ' - ')).toBe('One - Two');
  });
  it('leaves out emphasis, empty values and notes', () => {
    expect(scriptTitle(parse('Title:\n    **One** [[note]]\n    \n    Two'))).toBe('One · Two');
  });
  it('is empty without a title', () => {
    expect(scriptTitle(parse('Title:'))).toBe('');
    expect(scriptTitle(parse('Author: Me'))).toBe('');
    expect(scriptTitle(parse('Just action.'))).toBe('');
  });
});
