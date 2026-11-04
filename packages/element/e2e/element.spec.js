import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SAMPLE = readFileSync(new URL('../demo/sample.fountain', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const url = '/demo/index.html';

// Web-first locators pierce open shadow roots.
const host = (page) => page.locator('flow-script');
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => host(page).evaluate((el) => el.value);
const setValue = (page, v) => host(page).evaluate((el, v) => { el.value = v; }, v);
const lineWith = (page, text) => page.locator('flow-script .fl-line', { hasText: text }).first();
const rib = (page, name) => page.locator('flow-script .fl-ribbon').getByRole('button', { name, exact: true });

async function open(page) {
  await page.goto(url);
  await expect(editor(page)).toBeVisible();
}

test('source round-trips exactly through the editor', async ({ page }) => {
  await open(page);
  expect(await value(page)).toBe(SAMPLE);
});

test('markers hide off the active line and reveal on it, with style live throughout', async ({ page }) => {
  await open(page);
  await setValue(page, 'First **bold** line.\n\nSecond line.');
  const marker = page.locator('flow-script .fl-line .fl-marker').first();
  await expect(marker).toBeHidden();
  await expect(page.locator('flow-script .ProseMirror .fl-b').first()).toHaveCSS('font-weight', '700');

  await lineWith(page, 'First').click();
  await expect(marker).toBeVisible();
  await expect(page.locator('flow-script .ProseMirror .fl-b').first()).toHaveCSS('font-weight', '700');

  await lineWith(page, 'Second').click();
  await expect(marker).toBeHidden();
});

test('typing fountain auto-formats as you go', async ({ page }) => {
  await open(page);
  await setValue(page, '');
  await editor(page).click();
  await page.keyboard.type('INT. HOUSE - DAY');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('She *runs* now.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('BOB');
  await page.keyboard.press('Enter');
  await page.keyboard.type('(softly)');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Hello there.');

  expect(await value(page)).toBe('INT. HOUSE - DAY\n\nShe *runs* now.\n\nBOB\n(softly)\nHello there.');
  await expect(page.locator('flow-script .ProseMirror > .fl-line')).toHaveCount(7);
  await expect(lineWith(page, 'INT. HOUSE')).toHaveClass(/fl-scene/);
  await expect(lineWith(page, 'She')).toHaveClass(/fl-action/);
  await expect(lineWith(page, 'BOB')).toHaveClass(/fl-character/);
  await expect(lineWith(page, 'softly')).toHaveClass(/fl-parenthetical/);
  await expect(lineWith(page, 'Hello')).toHaveClass(/fl-dialogue/);
  await expect(page.locator('flow-script .ProseMirror .fl-i', { hasText: 'runs' })).toHaveCSS('font-style', 'italic');
});

test('B/I/U apply to a selection, via ribbon and keyboard, and toggle back off', async ({ page }) => {
  await open(page);
  await setValue(page, 'word');
  await lineWith(page, 'word').click();
  await page.keyboard.press('Control+a');
  await rib(page, 'B').click();
  expect(await value(page)).toBe('**word**');
  await expect(rib(page, 'B')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+b');
  expect(await value(page)).toBe('word');
  await page.keyboard.press('Control+i');
  expect(await value(page)).toBe('*word*');
  await page.keyboard.press('Control+i');
  await page.keyboard.press('Control+u');
  expect(await value(page)).toBe('_word_');
  await page.keyboard.press('Control+u');
  expect(await value(page)).toBe('word');
});

test('ribbon type buttons change the line and show the current type', async ({ page }) => {
  await open(page);
  await setValue(page, 'Top.\n\nwords here\n\nEnd.');
  await lineWith(page, 'words here').click();
  await expect(rib(page, 'Action')).toHaveAttribute('aria-pressed', 'true');
  await rib(page, 'Scene').click();
  expect(await value(page)).toBe('Top.\n\n.words here\n\nEnd.');
  await expect(lineWith(page, 'words here')).toHaveClass(/fl-scene/);
  await expect(rib(page, 'Scene')).toHaveAttribute('aria-pressed', 'true');
  await rib(page, 'Lyrics').click();
  expect(await value(page)).toBe('Top.\n\n~words here\n\nEnd.');
  await rib(page, 'Lyrics').click();
  expect(await value(page)).toBe('Top.\n\nwords here\n\nEnd.');
  await rib(page, 'Act').click();
  expect(await value(page)).toBe('Top.\n\n# words here\n\nEnd.');
  await page.keyboard.press('Control+z');
  expect(await value(page)).toBe('Top.\n\nwords here\n\nEnd.');
});

test('ribbon buttons carry their fountain character, grouped as related', async ({ page }) => {
  await open(page);
  const groups = await page.locator('flow-script .fl-group').evaluateAll((els) => els.map((g) => (
    [...g.querySelectorAll('button')].map((b) => {
      const icon = b.querySelector('.fl-icon')?.textContent;
      return icon ? `${icon} ${b.textContent.slice(icon.length)}` : b.textContent;
    })
  )));
  expect(groups.slice(1, 7)).toEqual([
    ['. Scene', '> Transition'],
    ['@ Character', '() Paren', '“ Dialogue', '^ Dual'],
    ['! Action', '>< Centered', '~ Lyrics'],
    ['# Act', '## Sequence', '= Synopsis'],
    ['[[ Note'],
    ['/* Boneyard'],
  ]);
  const badge = page.locator('flow-script .fl-icon').first();
  await expect(badge).toHaveCSS('border-top-left-radius', '3px');
  await expect(badge).toHaveCSS('color', 'rgb(180, 83, 9)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'amber-dark'));
  await expect(badge).toHaveCSS('color', 'rgb(255, 176, 0)');
  // A period sits on the baseline, so centering its ink has to lift it.
  const lift = await page.locator('flow-script .fl-icon-glyph').first().evaluate((g) => new DOMMatrix(getComputedStyle(g).transform).m42);
  expect(lift).toBeLessThan(0);
  const box = await badge.boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThan(3);
});

test('scene continuation shows in read-only and on editor page breaks, from the PDF menu', async ({ page }) => {
  await open(page);
  const beats = Array.from({ length: 70 }, (_, i) => `Beat ${i}.`).join('\n');
  await setValue(page, `INT. A - DAY\n\n${beats}`);
  await page.locator('flow-script .fl-menu summary').click();
  await page.locator('flow-script .fl-menu').getByText('Scene continued across pages').click();
  await expect(page.locator('flow-script .fl-page-gap').first()).toContainText('(CONTINUED)');
  await host(page).evaluate((el) => { el.readonly = true; });
  const pages = page.locator('flow-script .fl-page');
  await expect(pages.nth(0)).toContainText('(CONTINUED)');
  await expect(pages.nth(1)).toContainText('CONTINUED:');
});

test('the PDF menu stays on screen wherever the ribbon puts its button', async ({ page }) => {
  await open(page);
  const toggle = page.locator('flow-script .fl-menu summary');
  const menu = page.locator('flow-script .fl-menu-body');
  // The browser fires toggle just after opening, so give the position a moment to settle.
  const expectOnScreen = (label) => expect(async () => {
    const viewport = page.viewportSize();
    const box = await menu.boundingBox();
    expect(box.x, label).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, label).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, label).toBeLessThanOrEqual(viewport.height);
  }).toPass({ timeout: 2000 });
  for (const width of [1300, 900, 600, 390, 280]) {
    for (const buttonOnLeft of [false, true]) {
      await page.setViewportSize({ width, height: 800 });
      // Without the spacer, the button lands wherever wrapping leaves it, including far left.
      await page.locator('flow-script .fl-spacer').evaluate((s, on) => { s.style.display = on ? 'none' : ''; }, buttonOnLeft);
      await toggle.click();
      await expect(menu).toBeVisible();
      await expectOnScreen(`${width}px, buttonOnLeft=${buttonOnLeft}`);
      await toggle.click();
      await expect(menu).toBeHidden();
    }
  }
  // Force the far-left case exactly, which is what used to run off the screen.
  await page.setViewportSize({ width: 800, height: 800 });
  await page.locator('flow-script .fl-ribbon').evaluate((r) => { r.prepend(r.querySelector('.fl-menu')); });
  await toggle.click();
  await expectOnScreen('button first in ribbon');
  await expect(menu.getByText('Export PDF')).toBeInViewport({ ratio: 1 });
  // It also follows a resize while open.
  await page.setViewportSize({ width: 300, height: 800 });
  await expectOnScreen('resized while open');
  // And it fits a short window, scrolling rather than running off the bottom.
  await page.setViewportSize({ width: 800, height: 260 });
  await toggle.click();
  await toggle.click();
  await expect(menu).toBeVisible();
  await expectOnScreen('short window');
});

test('editor comments are bubbles that expand to the note text when opened', async ({ page }) => {
  await open(page);
  await setValue(page, 'Some action [[a private thought]] continues.\n\nOther line.');
  const chip = page.locator('flow-script .fl-bubble-chip');
  const src = page.locator('flow-script .fl-comment-src');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('a private thought');
  await expect(src).toBeHidden();
  await chip.click();
  await expect(src).toBeVisible();
  await expect(chip).toBeHidden();
  await page.keyboard.type('X');
  expect(await value(page)).toContain('[[Xa private thought]]');
  await lineWith(page, 'Other').click();
  await expect(chip).toBeVisible();
});

test('boneyard stays readable in place, unlike a comment bubble', async ({ page }) => {
  await open(page);
  await setValue(page, 'Keep /* cut words */ here.\n\n/* first\nsecond */\n\nOther [[a note]] line.\n\nLast.');
  await expect(page.locator('flow-script .fl-bubble-chip')).toHaveCount(1);
  await expect(page.locator('flow-script .fl-bubble-chip')).toContainText('a note');
  const cut = page.locator('flow-script .fl-boneyard', { hasText: 'cut words' }).first();
  await expect(cut).toBeVisible();
  await expect(cut).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.locator('flow-script .fl-boneyard', { hasText: 'second' }).first()).toBeVisible();
  const delimiter = page.locator('flow-script .fl-line', { hasText: 'Keep' }).locator('.fl-marker').first();
  await expect(delimiter).toBeHidden();
  await lineWith(page, 'Keep').click();
  await expect(delimiter).toBeVisible();
  await cut.click();
  await expect(rib(page, 'Boneyard')).toHaveAttribute('aria-pressed', 'true');
  await expect(rib(page, 'Note')).toHaveAttribute('aria-pressed', 'false');
  await host(page).evaluate((el) => { el.readonly = true; });
  const printed = await page.locator('flow-script .fl-pages').innerText();
  expect(printed).toContain('Keep');
  expect(printed).not.toContain('cut words');
  expect(printed).not.toContain('second');
});

test('boneyard button cuts the selection and restores it', async ({ page }) => {
  await open(page);
  await setValue(page, 'one two three');
  await lineWith(page, 'one two').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Shift+Control+ArrowRight');
  await rib(page, 'Boneyard').click();
  const cutValue = await value(page);
  expect(cutValue).toMatch(/^one \/\* two ?\*\/ ?three$/);
  await rib(page, 'Boneyard').click();
  expect(await value(page)).toBe('one two three');
  await page.keyboard.press('Control+z');
  expect(await value(page)).toBe(cutValue);
});

test('each ribbon action is its own undo step', async ({ page }) => {
  await open(page);
  await setValue(page, 'word');
  await lineWith(page, 'word').click();
  await page.keyboard.press('Control+a');
  await rib(page, 'B').click();
  await rib(page, 'I').click();
  expect(await value(page)).toBe('***word***');
  await rib(page, 'Undo').click();
  expect(await value(page)).toBe('**word**');
  await rib(page, 'Undo').click();
  expect(await value(page)).toBe('word');
});

test('multi-line notes collapse to one bubble', async ({ page }) => {
  await open(page);
  await setValue(page, 'Before.\n\n[[line one\nline two]]\n\nAfter.');
  await expect(page.locator('flow-script .fl-bubble-chip')).toHaveCount(1);
  await expect(page.locator('flow-script .fl-line', { hasText: 'line two' })).toBeHidden();
});

test('sections and synopses are editable but never printed', async ({ page }) => {
  await open(page);
  await setValue(page, '# Act One\n\n= summary\n\nINT. A - DAY\n\nAction.');
  await expect(lineWith(page, 'Act One')).toHaveClass(/fl-section/);
  const outline = await host(page).evaluate((el) => el.outline);
  expect(outline[0].title).toBe('Act One');
  expect(outline[0].children[0].title).toBe('INT. A - DAY');
  await host(page).evaluate((el) => { el.readonly = true; });
  const text = await page.locator('flow-script .fl-pages').innerText();
  expect(text).not.toContain('Act One');
  expect(text).not.toContain('summary');
  expect(text).toContain('INT. A - DAY');
});

test('read-only mode never loads Tiptap or pdf-lib', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/e2e/readonly.html');
  await expect(page.locator('flow-script .fl-page').first()).toBeVisible();
  await expect(page.locator('flow-script .ProseMirror')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-ribbon')).toHaveCount(0);
  expect(requests.filter((u) => /tiptap|prosemirror|editor|pdf/i.test(u))).toEqual([]);
  expect(await page.evaluate(() => !!document.querySelector('flow-script').shadowRoot.querySelector('[contenteditable]'))).toBe(false);
});

test('inline script source is dedented and read', async ({ page }) => {
  await page.goto('/e2e/readonly.html');
  const v = await host(page).evaluate((el) => el.value);
  expect(v.split('\n')[0]).toBe('Title: Fixture');
  await expect(page.locator('flow-script .fl-page')).toHaveCount(2);
});

test('read-only bubbles expand and collapse; boneyard stays out', async ({ page }) => {
  await open(page);
  await host(page).evaluate((el) => { el.readonly = true; });
  const bubble = page.locator('flow-script .fl-bubble').first();
  const body = bubble.locator('.fl-bubble-body');
  await expect(body).toBeHidden();
  await bubble.locator('summary').click();
  await expect(body).toBeVisible();
  await expect(body).toContainText('on the nose');
  await bubble.locator('summary').click();
  await expect(body).toBeHidden();
  expect(await page.locator('flow-script .fl-pages').innerText()).not.toContain('Cut this beat');
});

for (const view of ['page', 'flow']) {
  test(`read-only bubble opens in place as one pill in ${view} view`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page);
    await host(page).evaluate((el, view) => { el.view = view; el.readonly = true; }, view);
    const bubble = page.locator('flow-script .fl-bubble').first();
    const summary = bubble.locator('summary');
    const panel = bubble.locator('.fl-bubble-body');
    const icon = bubble.locator('.fl-bubble-icon');
    const close = bubble.locator('.fl-bubble-close');
    const row = page.locator('flow-script .fl-line, flow-script .fl-row').filter({ hasText: 'She sets the thermos' }).first();
    await expect(icon).toBeVisible();
    await expect(close).toBeHidden();
    await summary.scrollIntoViewIfNeeded();
    const closedBox = await summary.boundingBox();
    const closedIcon = await icon.boundingBox();
    const rowBefore = await row.boundingBox();

    await summary.click();
    await expect(panel).toBeVisible();
    await expect(close).toBeVisible();
    await expect(close).toHaveText('×');
    await expect(icon).toBeHidden();
    await expect(summary).toHaveAttribute('aria-label', 'Close note');

    // The button stays where it was and nothing around it moves.
    const openBox = await summary.boundingBox();
    const openClose = await close.boundingBox();
    expect(Math.abs(openBox.x - closedBox.x)).toBeLessThan(1);
    expect(Math.abs(openBox.y - closedBox.y)).toBeLessThan(1);
    expect(Math.abs((openClose.x + openClose.width / 2) - (closedIcon.x + closedIcon.width / 2))).toBeLessThan(1.5);
    const rowAfter = await row.boundingBox();
    expect(Math.abs(rowAfter.y - rowBefore.y)).toBeLessThan(1);

    // The button sits inside the panel, so the two read as a single shape.
    const panelBox = await panel.boundingBox();
    expect(panelBox.x).toBeLessThanOrEqual(openBox.x + 1);
    expect(panelBox.x + panelBox.width).toBeGreaterThanOrEqual(openBox.x + openBox.width - 1);
    expect(Math.abs(panelBox.y - openBox.y)).toBeLessThan(1);
    await expect(summary).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await summary.click();
    await expect(panel).toBeHidden();
    await expect(icon).toBeVisible();
    const reclosed = await summary.boundingBox();
    expect(Math.abs(reclosed.x - closedBox.x)).toBeLessThan(1);
  });
}

test('flow view keeps an opened bubble inside the script column', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await open(page);
  await setValue(page, 'A line that runs along almost to the edge of the column [[note near the right edge of the text column]] end.');
  await host(page).evaluate((el) => { el.view = 'flow'; el.readonly = true; });
  const bubble = page.locator('flow-script .fl-bubble').first();
  await bubble.locator('summary').click();
  const panel = await bubble.locator('.fl-bubble-body').boundingBox();
  const column = await page.locator('flow-script .fl-flow').boundingBox();
  await expect.poll(async () => (await bubble.locator('.fl-bubble-body').boundingBox()).x + panel.width).toBeLessThanOrEqual(column.x + column.width + 1);
});

test('page geometry: a letter page is 8.5x11in with one column at 0.1in', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page);
  await host(page).evaluate((el) => { el.readonly = true; });
  const box = await page.locator('flow-script .fl-page').first().boundingBox();
  expect(box.width).toBeCloseTo(816, 0);
  expect(box.height).toBeCloseTo(1056, 0);
  const m = await host(page).evaluate(async (el) => {
    await document.fonts.ready;
    const cell = [...el.shadowRoot.querySelectorAll('.fl-cell')].find((c) => c.textContent.length > 20);
    const r = document.createRange();
    r.selectNodeContents(cell);
    return { width: r.getBoundingClientRect().width, chars: cell.textContent.length };
  });
  expect(m.width / m.chars).toBeCloseTo(9.6, 1);
});

test('the bundled Courier Prime faces load and are used', async ({ page }) => {
  await open(page);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.fonts].map((f) => f.load()));
    return [...document.fonts].filter((f) => f.family.includes('Courier Prime') && f.status === 'loaded').length;
  });
  expect(loaded).toBe(4);
});

test('editor wraps at the same column as the printed page', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page);
  const longLine = 'word '.repeat(30).trim();
  await setValue(page, longLine);
  const printed = await host(page).evaluate((el) => el.exportPdf().then(() => true));
  expect(printed).toBe(true);
  const metrics = await lineWith(page, 'word').evaluate((line) => {
    const r = document.createRange();
    r.selectNodeContents(line);
    const rects = [...r.getClientRects()];
    return { width: line.getBoundingClientRect().width, first: rects[0].width };
  });
  // 61 columns at 9.6px, and the 60-column run of "word " pairs fits within it.
  expect(metrics.width).toBeCloseTo(61 * 9.6, 0);
  expect(Math.round(metrics.first / 9.6)).toBe(59);
});

test('page view scales to fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await host(page).evaluate((el) => { el.readonly = true; });
  const box = await page.locator('flow-script .fl-page').first().boundingBox();
  expect(box.width).toBeLessThanOrEqual(390);
  expect(box.height / box.width).toBeCloseTo(11 / 8.5, 2);
});

test('view switching works in both modes and keeps edits', async ({ page }) => {
  await open(page);
  await setValue(page, 'Hello.');
  await lineWith(page, 'Hello').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' World.');
  await rib(page, 'Page view').click();
  await expect(page.locator('flow-script .fl-flow.fl-editor-host .ProseMirror')).toBeVisible();
  expect(await value(page)).toBe('Hello. World.');
  await host(page).evaluate((el) => { el.readonly = true; });
  await expect(page.locator('flow-script .fl-flow')).toContainText('Hello. World.');
  await expect(page.locator('flow-script .fl-page')).toHaveCount(0);
  await host(page).evaluate((el) => { el.view = 'page'; });
  await expect(page.locator('flow-script .fl-page')).toHaveCount(1);
  await host(page).evaluate((el) => { el.readonly = false; });
  await expect(editor(page)).toBeVisible();
  expect(await value(page)).toBe('Hello. World.');
});

test('switching view keeps undo history and the cursor', async ({ page }) => {
  await open(page);
  await setValue(page, 'Hello.');
  await lineWith(page, 'Hello').click();
  await page.keyboard.press('End');
  await page.keyboard.type('A');
  await rib(page, 'Page view').click();
  await page.keyboard.type('B');
  expect(await value(page)).toBe('Hello.AB');
  await rib(page, 'Page view').click();
  await rib(page, 'Undo').click();
  expect(await value(page)).toBe('Hello.');
});

test('value set while the editor is loading, and after switching to read-only, still applies', async ({ page }) => {
  await page.goto('/e2e/blank.html');
  await page.addScriptTag({ type: 'module', url: '/src/index.js' });
  await page.waitForFunction(() => customElements.get('flow-script'));
  const shown = await page.evaluate(async () => {
    const el = document.createElement('flow-script');
    document.body.append(el);
    el.value = 'During load.';
    el.readonly = true;
    el.value = 'After switch.';
    return el.shadowRoot.querySelector('.fl-pages').textContent;
  });
  expect(shown).toContain('After switch.');
});

test('properties set before the element is defined are honored', async ({ page }) => {
  await page.goto('/e2e/blank.html');
  await page.evaluate(() => {
    document.body.innerHTML = '<flow-script></flow-script>';
    const el = document.querySelector('flow-script');
    el.value = 'Set early.';
    el.readonly = true;
  });
  await page.addScriptTag({ type: 'module', url: '/src/index.js' });
  await expect(page.locator('flow-script .fl-page')).toContainText('Set early.');
  expect(await host(page).evaluate((el) => el.value)).toBe('Set early.');
});

test('themes: presets, CSS variables and registered themes all apply', async ({ page }) => {
  await open(page);
  const paper = () => page.locator('flow-script .fl-sheet');
  await expect(paper()).toHaveCSS('background-color', 'rgb(255, 250, 240)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'amber-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(28, 22, 11)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'ocean'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(242, 249, 252)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'amber-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(255, 250, 240)');
  await host(page).evaluate((el) => el.style.setProperty('--flow-paper', 'rgb(1, 2, 3)'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(1, 2, 3)');
});

test('editor page breaks line up with the printed pages', async ({ page }) => {
  await open(page);
  const body = Array.from({ length: 150 }, (_, i) => `Action ${i}.\n`).join('\n');
  await setValue(page, body);
  const pageCount = await host(page).evaluate((el) => el.pageCount);
  await expect(page.locator('flow-script .fl-page-gap')).toHaveCount(pageCount - 1);
  await rib(page, 'Page view').click();
  await expect(page.locator('flow-script .fl-page-gap').first()).toBeHidden();
});

test('headings after a page break appear on the new page in the editor', async ({ page }) => {
  await open(page);
  await setValue(page, 'One.\n\n===\n\n# Act Two\n\n= Summary.\n\n## The Storm\n\nINT. A - DAY\n\nAction.');
  await expect(page.locator('flow-script .fl-page-gap')).toHaveCount(1);
  const order = await page.locator('flow-script .ProseMirror > *').evaluateAll((els) => els.map((e) => (e.classList.contains('fl-page-gap') ? 'GAP' : e.textContent)).filter(Boolean));
  expect(order).toEqual(['One.', '===', 'GAP', '# Act Two', '= Summary.', '## The Storm', 'INT. A - DAY', 'Action.']);
  await expect(lineWith(page, 'Act Two')).toBeVisible();
  const gapBox = await page.locator('flow-script .fl-page-gap').boundingBox();
  const headingBox = await lineWith(page, 'Act Two').boundingBox();
  expect(headingBox.y).toBeGreaterThan(gapBox.y + gapBox.height);
});

test('the title page gets a break in every view', async ({ page }) => {
  await open(page);
  await setValue(page, 'Title: BIG\n\n# Act One\n\nOne.\n\n===\n\nTwo.');
  const gap = page.locator('flow-script .fl-title-gap');
  await expect(gap).toBeVisible();
  await expect(gap).toHaveText('');
  const paged = await gap.boundingBox();
  expect(paged.height).toBeGreaterThan(20);
  const order = await page.locator('flow-script .ProseMirror > *').evaluateAll((els) => els.map((e) => (e.classList.contains('fl-title-gap') ? 'GAP' : e.textContent)).filter(Boolean));
  expect(order.slice(0, 3)).toEqual(['Title: BIG', 'GAP', '# Act One']);

  await rib(page, 'Page view').click();
  await expect(gap).toBeVisible();
  await expect(gap).toHaveCSS('border-top-style', 'dashed');
  expect((await gap.boundingBox()).height).toBeLessThan(5);

  await host(page).evaluate((el) => { el.readonly = true; });
  await expect(page.locator('flow-script .fl-flow .fl-break-rule')).toHaveCount(2);
  await expect(page.locator('flow-script .fl-flow')).not.toContainText('===');
});

test('paste becomes plain fountain lines', async ({ page }) => {
  await open(page);
  await setValue(page, 'Start');
  await lineWith(page, 'Start').click();
  await page.keyboard.press('End');
  await host(page).evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', ' one\r\n\r\nBOB\r\nHi');
    dt.setData('text/html', '<b>ignored</b>');
    el.shadowRoot.querySelector('.ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  expect(await value(page)).toBe('Start one\n\nBOB\nHi');
  await expect(lineWith(page, 'BOB')).toHaveClass(/fl-character/);
});

test('flow-change fires for edits but not for programmatic value', async ({ page }) => {
  await open(page);
  await host(page).evaluate((el) => {
    window.changes = [];
    el.addEventListener('flow-change', (e) => window.changes.push(e.detail));
    el.value = 'Set.';
  });
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await lineWith(page, 'Set').click();
  await page.keyboard.type('x');
  const changes = await page.evaluate(() => window.changes);
  expect(changes.length).toBe(1);
  expect(changes[0].value).toContain('x');
  expect(Array.isArray(changes[0].outline)).toBe(true);
});

test('PDF exports from the ribbon as a real file', async ({ page }) => {
  await open(page);
  const menu = page.locator('flow-script .fl-menu');
  await menu.locator('summary').click();
  const download = page.waitForEvent('download');
  await menu.getByText('Export PDF').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('THE LAST LIGHTHOUSE.pdf');
  await file.saveAs(`${process.env.FLOW_OUT ?? 'test-results'}/sample.pdf`);
  await expect(page.locator('flow-script .fl-status')).toContainText('Exported');
});

test('performance: a 100+ page script stays responsive while typing', async ({ page }) => {
  await open(page);
  const scene = (n) => `INT. ROOM ${n} - DAY\n\nSomeone *does* a thing that takes up most of a line of action text.\n\nBOB\n(quietly)\nHere is a line of dialogue that wraps a little bit.\n\nAMY\nAnd a reply to that line.\n\n`;
  await setValue(page, Array.from({ length: 450 }, (_, i) => scene(i)).join(''));
  const pages = await host(page).evaluate((el) => el.pageCount);
  expect(pages).toBeGreaterThan(100);
  await lineWith(page, 'ROOM 0').click();
  const start = Date.now();
  await page.keyboard.type('abcdefghij');
  const perKey = (Date.now() - start) / 10;
  console.log(`pages=${pages} perKey=${perKey.toFixed(1)}ms`);
  expect(perKey).toBeLessThan(process.env.CI ? 500 : 150);
});

test('screenshots for visual review', async ({ page }) => {
  test.skip(!process.env.FLOW_OUT, 'only when FLOW_OUT is set');
  const out = process.env.FLOW_OUT;
  await page.setViewportSize({ width: 1100, height: 1000 });
  await open(page);
  await page.evaluate(() => document.fonts.ready);
  await lineWith(page, 'very').click();
  await page.locator('flow-script .fl-scroll').evaluate((s) => { s.scrollTop = 420; });
  await page.screenshot({ path: `${out}/edit-page-light.png` });
  await host(page).evaluate((el) => el.setAttribute('theme', 'amber-dark'));
  await page.screenshot({ path: `${out}/edit-page-dark.png` });
  await rib(page, 'Page view').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/edit-flow-dark.png` });
  await host(page).evaluate((el) => { el.setAttribute('theme', 'amber-light'); el.view = 'page'; el.readonly = true; });
  await page.waitForTimeout(200);
  await page.locator('flow-script .fl-scroll').evaluate((s) => { s.scrollTop = 1100; });
  await page.screenshot({ path: `${out}/read-page.png` });
  await host(page).evaluate((el) => { el.view = 'flow'; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/read-flow.png` });
  await page.setViewportSize({ width: 390, height: 800 });
  await host(page).evaluate((el) => { el.readonly = false; el.view = 'page'; });
  await expect(editor(page)).toBeVisible();
  await page.screenshot({ path: `${out}/edit-phone.png` });
});
