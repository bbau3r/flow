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
const topicButton = (page) => page.locator('flow-script .fl-topics .fl-menu-trigger');
const statusbar = (page) => page.locator('flow-script .fl-statusbar');
const viewButton = (page) => statusbar(page).locator('.fl-menu-trigger:visible');
const historyButton = (page, name) => statusbar(page).getByRole('button', { name, exact: true });

async function chooseTopic(page, name) {
  await topicButton(page).click();
  await page.locator('flow-script .fl-topics').getByRole('menuitemradio', { name, exact: true }).click();
}

async function chooseView(page, name) {
  await viewButton(page).click();
  await statusbar(page).getByRole('menuitemradio', { name, exact: true }).click();
}

// The Read tab, or a view of the Write tab, by the name it goes by.
async function show(page, name) {
  if (name === 'Read') {
    await host(page).evaluate((el) => el.setAttribute('workspace', 'read'));
    return;
  }
  await host(page).evaluate((el) => el.setAttribute('workspace', 'write'));
  await chooseView(page, name);
}

async function openExport(page) {
  await page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true }).click();
  const dialog = page.locator('flow-script dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

// Most of these tests are about pages, so they start in paged view rather than the default.
async function open(page, { view = 'page' } = {}) {
  await page.goto(url);
  await expect(editor(page)).toBeVisible();
  if (view) await host(page).evaluate((el, v) => el.setAttribute('view', v), view);
}

// document.fonts.ready can resolve before Flow has registered its font, and machines
// without Courier measure differently until it arrives, so wait for the faces themselves.
const bundledFontLoaded = (page) => page.waitForFunction(
  () => [...document.fonts].filter((f) => f.family.includes('Courier Prime') && f.status === 'loaded').length === 4,
);

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

test('any all-caps line ending in a colon is a transition, not just TO:', async ({ page }) => {
  await open(page);
  await setValue(page, 'Action.\n\nSMASH CUT:\n\nMore.\n\nCUT TO:\n\nLast.\n\nLater that night:\n\nEnd.');
  await expect(lineWith(page, 'SMASH CUT:')).toHaveClass(/fl-transition/);
  await expect(lineWith(page, 'CUT TO:')).toHaveClass(/fl-transition/);
  await expect(lineWith(page, 'Later that night:')).toHaveClass(/fl-action/);
});

test('B/I/U apply to a selection, via ribbon and keyboard, and toggle back off', async ({ page }) => {
  await open(page);
  await setValue(page, 'word');
  await lineWith(page, 'word').click();
  await page.keyboard.press('Control+a');
  await rib(page, 'Bold').click();
  expect(await value(page)).toBe('**word**');
  await expect(rib(page, 'Bold')).toHaveAttribute('aria-pressed', 'true');
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

test('the topic dropdown changes the line and shows the current type', async ({ page }) => {
  await open(page);
  await setValue(page, 'Top.\n\nwords here\n\nEnd.');
  await lineWith(page, 'words here').click();
  await expect(topicButton(page)).toHaveAttribute('aria-label', 'Topic: Action');
  await chooseTopic(page, 'Scene');
  expect(await value(page)).toBe('Top.\n\n.words here\n\nEnd.');
  await expect(lineWith(page, 'words here')).toHaveClass(/fl-scene/);
  await expect(topicButton(page)).toHaveAttribute('aria-label', 'Topic: Scene');
  await chooseTopic(page, 'Lyrics');
  expect(await value(page)).toBe('Top.\n\n~words here\n\nEnd.');
  await expect(topicButton(page)).toHaveAttribute('aria-label', 'Topic: Lyrics');
  await chooseTopic(page, 'Lyrics');
  expect(await value(page)).toBe('Top.\n\nwords here\n\nEnd.');
  await chooseTopic(page, 'Act');
  expect(await value(page)).toBe('Top.\n\n# words here\n\nEnd.');
  await page.keyboard.press('Control+z');
  expect(await value(page)).toBe('Top.\n\nwords here\n\nEnd.');
});

test('the topic shows action on an empty line, and choosing it adds nothing', async ({ page }) => {
  await open(page);
  await setValue(page, 'One.\n\n\n\nTwo.');
  await lineWith(page, 'One').click();
  await page.keyboard.press('ArrowDown');
  await expect(topicButton(page)).toHaveAttribute('aria-label', 'Topic: Action');
  await chooseTopic(page, 'Action');
  expect(await value(page)).toBe('One.\n\n\n\nTwo.');
});

test('page break has its own pill just before comments', async ({ page }) => {
  await open(page);
  await setValue(page, 'words here');
  await lineWith(page, 'words').click();
  const labels = await page.locator('flow-script .fl-action-pills > .fl-pill').evaluateAll((pills) => pills.map((p) => p.getAttribute('aria-label')));
  expect(labels.indexOf('Page break')).toBe(labels.indexOf('Comments') - 1);
  await expect(rib(page, 'Page break').locator('.fl-svg')).toBeVisible();
  await rib(page, 'Page break').click();
  expect(await value(page)).toContain('===');
});

test('topics carry their fountain character, grouped as related', async ({ page }) => {
  await open(page);
  await topicButton(page).click();
  const items = await page.locator('flow-script .fl-topics .fl-menu-popup').evaluate((popup) => {
    const groups = [[]];
    for (const child of popup.children) {
      if (child.classList.contains('fl-menu-rule')) groups.push([]);
      else groups.at(-1).push(`${child.querySelector('.fl-icon').textContent} ${child.getAttribute('aria-label')}`);
    }
    return groups;
  });
  expect(items).toEqual([
    ['. Scene', '! Action', '> Transition', '>< Centered', '~ Lyrics'],
    ['@ Character', '() Parenthetical', '“ Dialogue'],
    ['# Act', '## Sequence', '= Synopsis'],
  ]);
  const badge = page.locator('flow-script .fl-menu-item .fl-icon').first();
  await expect(badge).toHaveCSS('border-top-left-radius', '3px');
  await expect(badge).toHaveCSS('color', 'rgb(82, 121, 111)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sage-dark'));
  await expect(badge).toHaveCSS('color', 'rgb(132, 169, 140)');
  // A period sits on the baseline, so centering its ink has to lift it.
  const lift = await page.locator('flow-script .fl-menu-item .fl-icon-glyph').first().evaluate((g) => new DOMMatrix(getComputedStyle(g).transform).m42);
  expect(lift).toBeLessThan(0);
  const box = await badge.boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThan(3);
});

const formatPills = (page) => page.locator('flow-script .fl-action-pills');
const collapseToggle = (page) => page.locator('flow-script .fl-action-toggle');

test('the arrow animates the formatting away, turns around, and brings it back', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  await setValue(page, 'BOB\nHello.');
  await lineWith(page, 'Hello').click();
  const toggle = collapseToggle(page);
  const pills = formatPills(page);
  const rotation = () => toggle.locator('.fl-svg').evaluate((svg) => new DOMMatrix(getComputedStyle(svg).transform).a);
  const width = (await pills.boundingBox()).width;

  // It starts as a left-pointing arrow, to the right of everything it hides.
  await expect(toggle).toHaveAttribute('aria-label', 'Hide formatting');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await rotation()).toBeCloseTo(1, 1);
  const dual = await rib(page, 'Dual').boundingBox();
  expect((await toggle.boundingBox()).x).toBeGreaterThan(dual.x + dual.width);

  await toggle.click();
  // It's animating, not just vanishing.
  expect(await pills.evaluate((el) => el.getAnimations().length)).toBe(1);
  await expect(pills).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-label', 'Show formatting');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(rotation).toBeCloseTo(-1, 1);
  // Its controls can't be reached by keyboard while hidden.
  await expect(rib(page, 'Bold')).toBeHidden();

  await toggle.click();
  expect(await pills.evaluate((el) => el.getAnimations().length)).toBe(1);
  await expect.poll(() => pills.evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(rib(page, 'Bold')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-label', 'Hide formatting');
  await expect.poll(rotation).toBeCloseTo(1, 1);
  expect((await pills.boundingBox()).width).toBeCloseTo(width, 0);

  // Everything still works, and its menu isn't cut off once it's back.
  await rib(page, 'Dual').click();
  expect(await value(page)).toContain('BOB ^');
  await topicButton(page).click();
  const popup = await page.locator('flow-script .fl-topics .fl-menu-popup').boundingBox();
  expect(popup.height).toBeGreaterThan(200);
});

test('each format action has its own shadow, tight enough to stay separate', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  const pills = page.locator('flow-script .fl-action-pills > .fl-pill:not([hidden])');
  const shadows = await pills.evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
  expect(shadows.length).toBeGreaterThan(2);
  for (const shadow of shadows) expect(shadow).not.toBe('none');
  await expect(page.locator('flow-script .fl-action-pills')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('flow-script .fl-ribbon')).toHaveCSS('box-shadow', 'none');

  // No layer reaches far enough to blend with the neighboring pill's.
  const first = await pills.nth(0).boundingBox();
  const second = await pills.nth(1).boundingBox();
  const gap = second.x - (first.x + first.width);
  const blurs = [...shadows[0].matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => Number(m[3]));
  expect(blurs.length).toBe(3);
  expect(Math.max(...blurs)).toBeLessThanOrEqual(gap);

  // Collapsing fades each pill by itself, and never clips or fades the group.
  await collapseToggle(page).click();
  const group = page.locator('flow-script .fl-action-pills');
  expect(await group.evaluate((el) => getComputedStyle(el).overflowX)).toBe('visible');
  const running = await group.evaluate((el) => ({
    group: el.getAnimations().flatMap((a) => a.effect.getKeyframes()).some((k) => 'opacity' in k),
    pills: [...el.children].filter((c) => !c.hidden).map((c) => c.getAnimations().length),
  }));
  expect(running.group).toBe(false);
  for (const count of running.pills) expect(count).toBe(1);
});

test('the arrow sits on a faint wash of the pill color, stronger under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  const toggle = collapseToggle(page);
  await expect(toggle.locator('xpath=ancestor::*[contains(@class, "fl-pill")]')).toHaveCount(0);
  await page.mouse.move(0, 0);
  const alpha = (color) => Number(color.match(/[\d.]+/g)[3] ?? 1);
  const resting = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(alpha(resting)).toBeCloseTo(0.65, 2);
  await expect(toggle).toHaveCSS('box-shadow', 'none');
  await toggle.hover();
  const hovered = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(hovered).not.toBe(resting);
  await page.mouse.move(0, 0);
  await toggle.click();
  await expect(formatPills(page)).toBeHidden();
  await page.mouse.move(0, 0);
  await expect(toggle).toHaveCSS('background-color', resting);
});

test('Read has its own views, Paged by default and Seamless on request, apart from Write', async ({ page }) => {
  await open(page, { view: 'flow' });
  await show(page, 'Read');
  const read = page.locator('flow-script .fl-read');
  await expect(read).toHaveClass(/fl-pages/);
  await expect(viewButton(page)).toHaveCount(1);
  await expect(statusbar(page).getByRole('button', { name: 'View: Paged' })).toBeVisible();
  await expect(statusbar(page).getByRole('button', { name: 'View: Seamless' })).toBeHidden();
  await statusbar(page).getByRole('button', { name: 'View: Paged' }).click();
  await expect(statusbar(page).getByRole('menuitemradio')).toHaveCount(2);
  await statusbar(page).getByRole('menuitemradio', { name: 'Seamless', exact: true }).click();
  await expect(host(page)).toHaveAttribute('read-view', 'flow');
  await expect(read).toHaveClass(/fl-flow/);
  await expect(read.locator('.fl-line.fl-scene').first()).toBeVisible();
  // Write keeps its own view, and Read keeps its choice coming back.
  await host(page).evaluate((el) => { el.workspace = 'write'; });
  await expect(host(page)).toHaveAttribute('view', 'flow');
  await expect(page.locator('flow-script .fl-read')).toHaveCount(0);
  await host(page).evaluate((el) => { el.workspace = 'read'; });
  await expect(page.locator('flow-script .fl-read')).toHaveClass(/fl-flow/);
  expect(await host(page).evaluate((el) => el.readView)).toBe('flow');
});

test('Ctrl with the wheel steps the scale, and a trackpad pinch follows the fingers', async ({ page }) => {
  await open(page);
  const scroller = page.locator('flow-script .fl-scroll');
  const box = await scroller.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const heard = () => host(page).evaluate((el) => new Promise((resolve) => {
    el.addEventListener('flow-scale', (event) => resolve(event.detail.scale), { once: true });
  }));
  let next = heard();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  expect(await next).toBe(120);
  await expect(statusbar(page).locator('.fl-scale')).toHaveText('120%');
  // A pinch arrives as small ctrl-wheel deltas, which together make the fingers' spread.
  next = heard();
  await scroller.evaluate((el) => {
    for (let i = 0; i < 10; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: -10 * Math.log(1.5), ctrlKey: true, bubbles: true, cancelable: true }));
  });
  expect(await next).toBe(180);
  // Without Ctrl, the wheel still scrolls.
  await page.mouse.wheel(0, 300);
  await expect(host(page)).toHaveAttribute('scale', '180');
  expect(await page.evaluate(() => window.visualViewport.scale)).toBe(1);
});

test('the chosen item in a dropdown sits on a faint wash of the accent', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await viewButton(page).click();
  const chosen = statusbar(page).getByRole('menuitemradio', { name: 'Paged', exact: true });
  const other = statusbar(page).getByRole('menuitemradio', { name: 'Seamless', exact: true });
  await expect(chosen).toHaveAttribute('aria-checked', 'true');
  await expect(other).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const wash = await chosen.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(Number(wash.match(/[\d.]+/g)[3])).toBeCloseTo(0.12, 2);
});

test('Read in Paged view jumps between pages beside the scale, typed or stepped', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await open(page, { view: 'flow' });
  const pages = statusbar(page).getByRole('group', { name: 'Pages' });
  await expect(pages).toBeHidden();
  await show(page, 'Read');
  await expect(pages).toBeVisible();
  const total = await page.locator('flow-script .fl-read .fl-page:not([data-page="title"])').count();
  expect(total).toBeGreaterThan(2);
  const field = pages.getByRole('textbox', { name: 'Page' });
  const previous = pages.getByRole('button', { name: 'Previous page' });
  const next = pages.getByRole('button', { name: 'Next page' });
  await expect(field).toHaveValue('1');
  await expect(pages).toContainText(`/ ${total}`);
  await expect(previous).toBeDisabled();
  // Right after the scale pill.
  const labels = await page.locator('flow-script .fl-statusbar > .fl-pill').evaluateAll((all) => all.filter((p) => !p.hidden).map((p) => p.getAttribute('aria-label')));
  expect(labels.slice(0, 3)).toEqual(['Read view', 'Page scale', 'Pages']);
  const topOf = (n) => page.locator(`flow-script .fl-read .fl-page[data-page="${n}"]`).evaluate((el) => {
    const scroll = el.closest('.fl-scroll');
    return el.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  });
  await field.fill('3');
  await field.press('Enter');
  await expect(field).toHaveValue('3');
  const landed = await topOf(3);
  expect(landed).toBeGreaterThan(0);
  expect(landed).toBeLessThan(200);
  await previous.click();
  await expect(field).toHaveValue('2');
  await next.click();
  await expect(field).toHaveValue('3');
  // Out of range goes to the last page; scrolling by hand keeps the number in step.
  await field.fill('999');
  await field.press('Enter');
  await expect(field).toHaveValue(String(total));
  await expect(next).toBeDisabled();
  await page.locator('flow-script .fl-scroll').evaluate((el) => { el.scrollTop = 0; });
  await expect(field).toHaveValue('1');
  // Seamless has no pages to jump between.
  await host(page).evaluate((el) => { el.readView = 'flow'; });
  await expect(pages).toBeHidden();
});

test('the Write tab in Paged view jumps between pages too, and the pill has no icon of its own', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await open(page, { view: 'flow' });
  await setValue(page, Array.from({ length: 150 }, (_, i) => `Action ${i}.`).join('\n\n'));
  const pages = statusbar(page).getByRole('group', { name: 'Pages' });
  await expect(pages).toBeHidden();
  await chooseView(page, 'Paged');
  await expect(pages).toBeVisible();
  await expect(pages.locator('svg:visible')).toHaveCount(2);
  const field = pages.getByRole('textbox', { name: 'Page' });
  await expect(field).toHaveValue('1');
  const gaps = page.locator('flow-script .fl-page-gap[data-page]');
  await expect(gaps.first()).toBeAttached();
  const total = (await gaps.count()) + 1;
  await expect(pages).toContainText(`/ ${total}`);
  await field.fill('3');
  await field.press('Enter');
  await expect(field).toHaveValue('3');
  const gap = await page.locator('flow-script .fl-page-gap[data-page="3"]').boundingBox();
  const bar = await page.locator('flow-script .fl-chrome').boundingBox();
  expect(gap.y + gap.height).toBeGreaterThan(bar.y + bar.height - 1);
  expect(gap.y + gap.height).toBeLessThan(bar.y + bar.height + 60);
  await pages.getByRole('button', { name: 'Previous page' }).click();
  await expect(field).toHaveValue('2');
  await chooseView(page, 'Seamless');
  await expect(pages).toBeHidden();
});

test('on a phone, the scale and page pills fold to buttons that open them as dropdowns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await open(page);
  await show(page, 'Read');
  const scale = statusbar(page).getByRole('group', { name: 'Page scale' });
  const showScale = statusbar(page).getByRole('button', { name: 'Show page scale' });
  const showPages = statusbar(page).getByRole('button', { name: 'Show pages' });
  const percent = statusbar(page).locator('.fl-scale');
  const typed = statusbar(page).getByRole('textbox', { name: 'Page scale, in percent' });
  const field = statusbar(page).getByRole('textbox', { name: 'Page' });
  // Folded, the scale still shows beside its icon, and the button opens the dropdown.
  await expect(showScale).toBeVisible();
  await expect(showScale).toHaveText('100%');
  await expect(showScale.locator('svg')).toHaveCount(1);
  await expect(showPages).toBeVisible();
  await expect(showPages).toHaveText('1');
  await expect(percent).toBeHidden();
  await expect(field).toBeHidden();
  await showScale.click();
  await expect(showScale).toHaveAttribute('aria-expanded', 'true');
  await expect(typed).toBeVisible();
  await expect(typed).toHaveValue('100');
  // Above the pill: a heading with its icon, then the value, then the buttons.
  const body = statusbar(page).locator('.fl-fold-open > .fl-fold-body');
  const pillBox = await scale.boundingBox();
  const bodyBox = await body.boundingBox();
  expect(bodyBox.y + bodyBox.height).toBeLessThan(pillBox.y);
  const heading = body.locator('.fl-menu-heading');
  await expect(heading).toHaveText('Page scale');
  await expect(heading.locator('svg')).toHaveCount(1);
  const rows = await Promise.all([heading, body.locator('.fl-fold-value'), body.locator('.fl-fold-actions')].map((row) => row.boundingBox()));
  expect(rows[0].y + rows[0].height).toBeLessThanOrEqual(rows[1].y + 1);
  expect(rows[1].y + rows[1].height).toBeLessThanOrEqual(rows[2].y + 1);
  // Centered over its button.
  const toggleBox = await showScale.boundingBox();
  expect(bodyBox.x + bodyBox.width / 2).toBeCloseTo(toggleBox.x + toggleBox.width / 2, 0);
  // The scale can be typed, stepped, or reset with its own button.
  const reset = statusbar(page).getByRole('button', { name: 'Reset to 100%', exact: true });
  await expect(reset).toBeDisabled();
  await statusbar(page).getByRole('button', { name: 'Larger' }).click();
  await expect(typed).toHaveValue('110');
  await expect(showScale).toHaveText('110%');
  await typed.fill('150');
  await typed.press('Enter');
  await expect(host(page)).toHaveAttribute('scale', '150');
  await typed.fill('900');
  await typed.press('Enter');
  await expect(typed).toHaveValue('200');
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(typed).toHaveValue('100');
  await expect(showScale).toHaveText('100%');
  // Opening the other closes this one, as does Escape.
  await showPages.click();
  await expect(typed).toBeHidden();
  await expect(field).toBeVisible();
  await expect(statusbar(page).locator('.fl-fold-open .fl-menu-heading')).toHaveText('Pages');
  await field.fill('2');
  await field.press('Enter');
  await expect(showPages).toHaveText('2');
  const pagesBody = await statusbar(page).locator('.fl-fold-open > .fl-fold-body').boundingBox();
  const pagesToggle = await showPages.boundingBox();
  expect(pagesBody.x + pagesBody.width / 2).toBeCloseTo(pagesToggle.x + pagesToggle.width / 2, 0);
  await page.keyboard.press('Escape');
  await expect(field).toBeHidden();
  // Wider again, both pills show their controls with no fold, and 100% resets.
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(showScale).toBeHidden();
  await expect(typed).toBeHidden();
  await expect(reset).toBeHidden();
  await expect(percent).toBeVisible();
  await expect(field).toBeVisible();
});

test('pinching scales the script, not the page, and the app hears the new scale', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 800, height: 900 } });
  const page = await context.newPage();
  await open(page);
  const heard = host(page).evaluate((el) => new Promise((resolve) => {
    el.addEventListener('flow-scale', (event) => resolve(event.detail.scale), { once: true });
  }));
  const scroller = page.locator('flow-script .fl-scroll');
  await expect(scroller).toHaveCSS('touch-action', 'pan-x pan-y');
  const box = await scroller.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const fingers = (gap) => [{ x: cx - gap / 2, y: cy, id: 1 }, { x: cx + gap / 2, y: cy, id: 2 }];
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(100) });
  for (const gap of [120, 150, 200]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(gap) });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await heard).toBe(200);
  await expect(host(page)).toHaveAttribute('scale', '200');
  await expect(statusbar(page).locator('.fl-scale')).toHaveText('200%');
  expect(await page.evaluate(() => window.visualViewport.scale)).toBe(1);
  await context.close();
});

test('collapsing keeps the rest of the row in place, and keeps up with quick clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  const pdf = page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true });
  const before = await pdf.boundingBox();
  const toggle = collapseToggle(page);
  await toggle.click();
  // Turned back mid-animation, it ends up open.
  await toggle.click();
  await expect.poll(() => formatPills(page).evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(rib(page, 'Bold')).toBeVisible();
  await toggle.click();
  await expect(formatPills(page)).toBeHidden();
  const after = await pdf.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);

  // Going through Read doesn't lose the choice.
  await show(page, 'Read');
  await expect(toggle).toBeHidden();
  await show(page, 'Paged');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(formatPills(page)).toBeHidden();
});

test('folded on its own row, the action center keeps its place and gives the page that row', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await open(page);
  const inset = () => host(page).evaluate((el) => parseFloat(el.style.getPropertyValue('--fl-inset-top')));
  // Well below the top row's middle is the second row.
  const secondRow = async () => {
    const box = await page.locator('flow-script .fl-export').boundingBox();
    return box.y + box.height / 2 + 20;
  };
  const open_ = await inset();
  const toggle = collapseToggle(page);
  const before = await toggle.boundingBox();
  const rowStart = (await formatPills(page).boundingBox()).x;
  expect(before.y).toBeGreaterThan(await secondRow());
  await toggle.click();
  await expect(formatPills(page)).toBeHidden();
  await expect.poll(inset).toBeLessThan(open_ - 30);
  const after = await toggle.boundingBox();
  expect(after.y).toBeGreaterThan(await secondRow());
  expect(Math.abs(after.y - before.y)).toBeLessThan(6);
  // Where the folded row's toggle ends up as the pills close in front of it.
  expect(Math.abs(after.x - rowStart)).toBeLessThan(2);
  await toggle.click();
  await expect.poll(inset).toBe(open_);
});

test('checkboxes, fields and the palette roles follow the theme', async ({ page }) => {
  await open(page);
  await host(page).evaluate((el) => el.setAttribute('theme', 'sand-light'));
  const dialog = await openExport(page);
  await expect(dialog.locator('input[type="checkbox"]').first()).toHaveCSS('accent-color', 'rgb(151, 89, 44)');
  const roles = await host(page).evaluate((el) => {
    const style = getComputedStyle(el);
    return ['secondary', 'secondary-ink', 'success', 'warning', 'danger'].map((name) => style.getPropertyValue(`--flow-${name}`).trim());
  });
  expect(roles.every(Boolean)).toBe(true);
});

test('collapsing skips the animation for people who ask for less motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await collapseToggle(page).click();
  await expect(formatPills(page)).toBeHidden();
  await collapseToggle(page).click();
  await expect(rib(page, 'Bold')).toBeVisible();
});

test('dual shows and stays highlighted across a whole speech', async ({ page }) => {
  await open(page);
  await setValue(page, 'Action.\n\nBOB\nHello.\n\nAMY ^\n(softly)\nHi.\nThere.\n\nAfter.');
  const dual = rib(page, 'Dual');
  for (const line of ['AMY', 'softly', 'Hi.', 'There.']) {
    await lineWith(page, line).click();
    await expect(dual, line).toBeVisible();
    await expect(dual, line).toHaveAttribute('aria-pressed', 'true');
  }
  await lineWith(page, 'Hello').click();
  await expect(dual).toBeVisible();
  await expect(dual).toHaveAttribute('aria-pressed', 'false');
  await lineWith(page, 'BOB').click();
  await expect(dual).toBeVisible();
  await lineWith(page, 'After').click();
  await expect(dual).toBeHidden();

  // It can be turned off from any line of the speech.
  await lineWith(page, 'softly').click();
  await dual.click();
  expect(await value(page)).toContain('AMY\n(softly)');
  await expect(dual).toHaveAttribute('aria-pressed', 'false');
});

test('a pressed dual has a primary icon on the secondary color', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  await setValue(page, 'BOB\nHello.\n\nAMY ^\nHi.');
  await lineWith(page, 'Hi.').click();
  const dual = rib(page, 'Dual');
  await expect(dual).toHaveAttribute('aria-pressed', 'true');
  const accent = 'rgb(82, 121, 111)';
  const badge = dual.locator('.fl-icon');
  await expect(badge).toHaveCSS('background-color', accent);
  await expect(badge).toHaveCSS('color', 'rgb(246, 248, 244)');
  const background = await dual.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe(accent);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  // The label stays in the normal text color, not on primary.
  await expect(dual.locator('.fl-label')).toHaveCSS('color', 'rgb(47, 62, 70)');

  // Other pressed buttons keep the full primary look.
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await rib(page, 'Bold').click();
  await expect(rib(page, 'Bold')).toHaveAttribute('aria-pressed', 'true');
  await expect(rib(page, 'Bold')).toHaveCSS('background-color', accent);
});

test('the dual button only appears on dialogue lines', async ({ page }) => {
  await open(page);
  await setValue(page, 'Action.\n\nBOB\nHello.\n\nAMY\nHi.');
  await lineWith(page, 'Action').click();
  await expect(rib(page, 'Dual')).toBeHidden();
  await lineWith(page, 'Hi').click();
  await expect(rib(page, 'Dual')).toBeVisible();
  await rib(page, 'Dual').click();
  expect(await value(page)).toContain('AMY ^');
});

test('formatting shares the top row when it fits, and otherwise leans left on its own', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await open(page);
  await setValue(page, 'BOB\nHello.');
  await lineWith(page, 'Hello').click();
  await expect(rib(page, 'Dual')).toBeVisible();
  const pdf = () => page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true }).boundingBox();
  const middle = (box) => box.y + box.height / 2;

  // On one row, with the longest set of pills, nothing overlaps or leaves the window.
  const bold = await rib(page, 'Bold').boundingBox();
  const dual = await rib(page, 'Dual').boundingBox();
  const export1 = await pdf();
  expect(Math.abs(middle(bold) - middle(export1))).toBeLessThan(2);
  expect(dual.x + dual.width).toBeLessThanOrEqual((await page.locator('flow-script .fl-export').boundingBox()).x);
  expect(export1.x + export1.width).toBeLessThanOrEqual(1000);
  // Dual appears at the end of the row, so nothing else moves for it.
  await lineWith(page, 'BOB').click();
  await setValue(page, 'Action.');
  await lineWith(page, 'Action').click();
  await expect(rib(page, 'Dual')).toBeHidden();
  expect((await rib(page, 'Bold').boundingBox()).x).toBeCloseTo(bold.x, 0);

  // Too narrow for one row, formatting drops to the left of its own.
  await page.setViewportSize({ width: 999, height: 800 });
  const row = await page.locator('flow-script .fl-ribbon').boundingBox();
  const narrowBold = await rib(page, 'Bold').boundingBox();
  const narrowPdf = await pdf();
  expect(narrowBold.y).toBeGreaterThan(narrowPdf.y + narrowPdf.height - 1);
  expect(narrowBold.x - row.x).toBeLessThan(6);
});

test.describe('at phone width', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('the arrow follows the pills without covering them, and collapses them', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    const toggle = collapseToggle(page);
    const comment = await rib(page, 'Comment').boundingBox();
    const arrow = await toggle.boundingBox();
    expect(arrow.x).toBeGreaterThanOrEqual(comment.x + comment.width);
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport({ ratio: 1 });
    await toggle.click();
    await expect(formatPills(page)).toBeHidden();
    expect(await page.locator('flow-script .fl-ribbon').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await toggle.click();
    await expect(rib(page, 'Bold')).toBeVisible();
  });

  test('formatting scrolls sideways when it doesn\'t fit, without moving the page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    const row = page.locator('flow-script .fl-ribbon');
    const scroll = page.locator('flow-script .fl-scroll');
    const bold = await rib(page, 'Bold').boundingBox();
    const comment = await rib(page, 'Comment').boundingBox();
    expect(Math.abs(bold.y - comment.y)).toBeLessThan(2);
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
    expect(await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

    // The thin scrollbar uses the primary color.
    await expect(row).toHaveCSS('scrollbar-width', 'thin');
    const accent = await rib(page, 'Bold').evaluate((el) => getComputedStyle(el).getPropertyValue('--flow-accent').trim());
    expect(accent).toBe('#52796f');
    expect(await row.evaluate((el) => getComputedStyle(el).scrollbarColor)).toContain('rgb(82, 121, 111)');

    // Everything can be reached and used once scrolled to.
    await setValue(page, 'word');
    await lineWith(page, 'word').click();
    await rib(page, 'Comment').scrollIntoViewIfNeeded();
    await expect(rib(page, 'Comment')).toBeInViewport({ ratio: 1 });
    expect(await row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await rib(page, 'Comment').click();
    expect(await value(page)).toContain('[[');

    // A pill's shadow isn't cut off by the scrolling row.
    const shadowRoom = await row.evaluate((el) => {
      const pill = el.querySelector('.fl-pill').getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { above: pill.top - box.top, below: box.bottom - pill.bottom };
    });
    expect(shadowRoom.above).toBeGreaterThanOrEqual(6);
    expect(shadowRoom.below).toBeGreaterThanOrEqual(12);
  });

  test('the topic menu opens whole from the scrolling row, wherever it has scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await setValue(page, 'word');
    await lineWith(page, 'word').click();
    const row = page.locator('flow-script .fl-ribbon');
    for (const scrollLeft of [0, 40, 400]) {
      await row.evaluate((el, left) => { el.scrollLeft = left; }, scrollLeft);
      await topicButton(page).click();
      const popup = page.locator('flow-script .fl-topics .fl-menu-popup');
      await expect(popup).toBeVisible();
      const box = await popup.boundingBox();
      const trigger = await topicButton(page).boundingBox();
      expect(box.x, `left at ${scrollLeft}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `right at ${scrollLeft}`).toBeLessThanOrEqual(320);
      expect(box.y, `below the button at ${scrollLeft}`).toBeGreaterThanOrEqual(trigger.y + trigger.height);
      expect(box.height).toBeGreaterThan(200);
      await page.keyboard.press('Escape');
    }
    await chooseTopic(page, 'Scene');
    expect(await value(page)).toBe('.word');
  });

  test('the formatting pills fit on one row', async ({ page }) => {
    await open(page);
    const bold = await rib(page, 'Bold').boundingBox();
    const comment = await rib(page, 'Comment').boundingBox();
    expect(Math.abs(bold.y - comment.y)).toBeLessThan(2);
  });
});

test('page break and comment sit just after the topic dropdown, as icons at every size', async ({ page }) => {
  for (const width of [1400, 800, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const labels = await page.locator('flow-script .fl-action-pills > .fl-pill').evaluateAll((pills) => pills.map((p) => p.getAttribute('aria-label')));
    expect(labels.slice(1, 4)).toEqual(['Topic', 'Page break', 'Comments']);
    for (const name of ['Page break', 'Comment']) {
      await expect(rib(page, name).locator('.fl-svg')).toBeVisible();
      await expect(rib(page, name).locator('.fl-label')).toHaveCount(0);
      await expect(rib(page, name)).toHaveAttribute('title', /./);
    }
  }
});

test('undo and redo sit at the bottom right, and follow what can be undone', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  await setValue(page, 'word');
  await expect(page.locator('flow-script .fl-ribbon').getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  const undo = await historyButton(page, 'Undo').boundingBox();
  const bar = await statusbar(page).boundingBox();
  expect(undo.x).toBeGreaterThan(bar.x + bar.width / 2);
  await expect(historyButton(page, 'Undo')).toBeDisabled();
  await lineWith(page, 'word').click();
  await page.keyboard.type('x');
  await expect(historyButton(page, 'Undo')).toBeEnabled();
  await expect(historyButton(page, 'Redo')).toBeDisabled();
  await historyButton(page, 'Undo').click();
  await expect(historyButton(page, 'Redo')).toBeEnabled();
  await show(page, 'Read');
  await expect(historyButton(page, 'Undo')).toBeHidden();
  await show(page, 'Paged');
  await expect(historyButton(page, 'Undo')).toBeVisible();
});

test('the top row floats over the page too, and its menus reach over the formatting row', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await open(page);
  await setValue(page, Array.from({ length: 200 }, (_, i) => `Beat ${i}.`).join('\n\n'));
  const pdf = page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true });
  const sheet = page.locator('flow-script .fl-sheet');
  const before = await pdf.boundingBox();
  await page.locator('flow-script .fl-scroll').evaluate((el) => { el.scrollTop = 600; });
  const after = await pdf.boundingBox();
  expect(after.y).toBeCloseTo(before.y, 0);
  expect((await sheet.boundingBox()).y).toBeLessThan(after.y);

  // The gap between pills in the top row lets clicks through to the script.
  const atGap = await host(page).evaluate((el, at) => el.shadowRoot.elementFromPoint(at.x, at.y)?.closest('.fl-pill, .fl-sheet')?.className ?? '', { x: 600, y: after.y + 5 });
  expect(atGap).toContain('fl-sheet');
  const atPdf = await host(page).evaluate((el, at) => el.shadowRoot.elementFromPoint(at.x, at.y)?.closest('.fl-pill, .fl-sheet')?.className ?? '', { x: after.x + 5, y: after.y + 5 });
  expect(atPdf).toContain('fl-pill');
  await pdf.click();
  await expect(page.locator('flow-script dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // A menu from the top row sits over the formatting row and can be clicked.
  await page.setViewportSize({ width: 500, height: 700 });
  const holder = page.locator('flow-script .fl-export-holder');
  await holder.getByRole('button', { name: 'Export', exact: true }).click();
  await holder.getByRole('menuitem', { name: 'PDF', exact: true }).click();
  await expect(page.locator('flow-script dialog')).toBeVisible();
});

test('the bottom pills are separate, and float over the page with clicks passing between them', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await open(page);
  await setValue(page, Array.from({ length: 200 }, (_, i) => `Beat ${i}.`).join('\n\n'));
  const labels = await page.locator('flow-script .fl-statusbar > .fl-pill').evaluateAll((pills) => pills.filter((p) => !p.hidden).map((p) => p.getAttribute('aria-label')));
  expect(labels).toEqual(['View', 'Page scale', 'Pages', 'History']);
  const scaleBox = await page.locator('flow-script .fl-statusbar > .fl-pill:visible').nth(1).boundingBox();
  const viewBox = await page.locator('flow-script .fl-statusbar > .fl-pill:visible').nth(0).boundingBox();
  expect(scaleBox.x).toBeGreaterThan(viewBox.x + viewBox.width);

  const sheet = page.locator('flow-script .fl-sheet');
  const scroll = page.locator('flow-script .fl-scroll');
  await scroll.evaluate((el) => { el.scrollTop = 800; });
  // The script runs on beneath the pills, to the bottom of the window.
  const bar = await statusbar(page).boundingBox();
  const passed = await sheet.boundingBox();
  expect(passed.y + passed.height).toBeGreaterThan(bar.y + bar.height);
  expect(bar.y + bar.height).toBeCloseTo(700, 0);
  const at = { x: 600, y: scaleBox.y + 10 };
  const under = await host(page).evaluate((el, p) => el.shadowRoot.elementFromPoint(p.x, p.y)?.closest('.fl-pill, .fl-sheet')?.className ?? '', at);
  expect(under).toContain('fl-sheet');

  // The script's end stops above the pills, so its last lines can be read.
  await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const endOfSheet = await sheet.boundingBox();
  expect(endOfSheet.y + endOfSheet.height).toBeLessThanOrEqual((await statusbar(page).boundingBox()).y + 1);

  // A short script still leaves them at the bottom, in every view.
  await setValue(page, 'Short.');
  for (const view of ['Seamless', 'Fountain', 'Read', 'Paged']) {
    await show(page, view);
    await host(page).evaluate((el) => { el.scale = 50; });
    await expect.poll(async () => { const box = await statusbar(page).boundingBox(); return Math.round(box.y + box.height); }).toBe(700);
  }
});

for (const view of ['Paged', 'Seamless', 'Fountain']) {
  test(`typing never hides the line under the bottom pills in ${view} view`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await open(page);
    await setValue(page, Array.from({ length: 120 }, (_, i) => `Beat ${i}.`).join('\n\n'));
    await chooseView(page, view);
    await lineWith(page, 'Beat 60.').click();
    await page.waitForTimeout(100);
    await host(page).evaluate((el) => {
      const scroller = el.shadowRoot.querySelector('.fl-scroll');
      const line = [...el.shadowRoot.querySelectorAll('.fl-line')].find((l) => l.textContent === 'Beat 60.');
      scroller.scrollTop += line.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 10;
    });
    const barBox = await statusbar(page).boundingBox();
    const before = await lineWith(page, 'Beat 60.').boundingBox();
    expect(before.y + before.height).toBeGreaterThan(barBox.y);
    await page.keyboard.type('x');
    await expect.poll(async () => {
      const box = await lineWith(page, 'Beat 60.x').boundingBox();
      return box.y + box.height;
    }).toBeLessThanOrEqual(barBox.y);
  });
}

for (const view of ['Paged', 'Seamless', 'Fountain', 'Read']) {
  test(`a long script keeps both bars pinned while scrolling all the way in ${view}`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await open(page);
    await setValue(page, Array.from({ length: 200 }, (_, i) => `Beat ${i}.`).join('\n\n'));
    await show(page, view);
    const scroll = page.locator('flow-script .fl-scroll');
    const pdf = page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true });
    const scale = page.locator('flow-script .fl-scale');
    const atTop = { pdf: await pdf.boundingBox(), scale: await scale.boundingBox() };
    const { scrollHeight, clientHeight } = await scroll.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scrollHeight).toBeGreaterThan(clientHeight * 3);
    for (const fraction of [0.33, 0.66, 1]) {
      await scroll.evaluate((el, f) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * f; }, fraction);
      expect((await pdf.boundingBox()).y).toBeCloseTo(atTop.pdf.y, 0);
      expect((await scale.boundingBox()).y).toBeCloseTo(atTop.scale.y, 0);
      expect((await scale.boundingBox()).y).toBeGreaterThan(500);
    }
    // The last of the script comes into view, clear of the bottom pills.
    const barTop = (await statusbar(page).boundingBox()).y;
    const last = page.locator('flow-script .fl-line, flow-script .fl-row').filter({ hasText: 'Beat 199.', visible: true }).first();
    const lastBox = await last.boundingBox();
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barTop);
    // A printed page keeps its blank space below the text, so there it's the page's end that shows.
    if (view === 'Read') {
      const page2 = await page.locator('flow-script .fl-page').last().boundingBox();
      expect(page2.y + page2.height).toBeLessThanOrEqual(barTop);
    } else {
      expect(lastBox.y).toBeGreaterThan(0);
    }
  });
}

test('pages appear as a script grows while typing', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await open(page);
  await setValue(page, 'Start.');
  const gaps = page.locator('flow-script .fl-page-gap');
  await expect(gaps).toHaveCount(0);
  await lineWith(page, 'Start').click();
  await page.keyboard.press('End');
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('x');
  }
  await expect(gaps.first()).toBeAttached();
  const gap = gaps.first();
  await gap.scrollIntoViewIfNeeded();
  await expect(gap).toBeVisible();
  const box = await gap.boundingBox();
  expect(box.height).toBeGreaterThan(20);
  // The sheet holds the new page, rather than the text running out of it.
  // Measured in one go, since another page's gap can arrive at any moment after typing stops.
  const { height, overflow } = await host(page).evaluate((el) => {
    const sheetBox = el.shadowRoot.querySelector('.fl-sheet').getBoundingClientRect();
    const lines = el.shadowRoot.querySelectorAll('.ProseMirror > .fl-line');
    return { height: sheetBox.height, overflow: lines[lines.length - 1].getBoundingClientRect().bottom - sheetBox.bottom };
  });
  expect(height).toBeGreaterThan(1056);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the bottom pills are smaller than the top ones, including what an app adds', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await open(page);
  await host(page).evaluate((el) => {
    const added = document.createElement('button');
    added.className = 'fl-btn';
    added.slot = 'status-end';
    added.textContent = 'Added';
    el.append(added);
  });
  const top = await rib(page, 'Bold').boundingBox();
  const bottom = await statusbar(page).getByRole('button', { name: 'Larger' }).boundingBox();
  expect(bottom.height).toBeLessThan(top.height);
  const inherited = await host(page).getByRole('button', { name: 'Added' }).evaluate((b) => getComputedStyle(b).getPropertyValue('--fl-control-size'));
  expect(inherited.trim()).toBe(`${bottom.height}px`);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('the bottom pills stay the same size as on a big screen', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const fold = statusbar(page).getByRole('button', { name: 'Show page scale' });
    expect((await fold.boundingBox()).height).toBe(22);
    await expect(fold).toHaveCSS('font-size', '11.5px');
  });
});

test('a status message gets its own pill only when there is one', async ({ page }) => {
  await open(page);
  const status = page.locator('flow-script .fl-status');
  await expect(status).toBeHidden();
  const dialog = await openExport(page);
  await dialog.getByRole('button', { name: 'Export PDF' }).click();
  await expect(status).toContainText('Exported');
  await expect(status).toBeVisible();
});

test('the formatting row starts above the page, then floats over it on scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await open(page);
  await setValue(page, Array.from({ length: 200 }, (_, i) => `Beat ${i}.`).join('\n\n'));
  const row = page.locator('flow-script .fl-ribbon');
  const sheet = page.locator('flow-script .fl-sheet');
  const scroll = page.locator('flow-script .fl-scroll');
  const before = await row.boundingBox();
  expect((await sheet.boundingBox()).y).toBeGreaterThanOrEqual(before.y + before.height);

  await scroll.evaluate((el) => { el.scrollTop = 600; });
  const after = await row.boundingBox();
  expect(after.y).toBeCloseTo(before.y, 0);
  const passed = await sheet.boundingBox();
  expect(passed.y).toBeLessThan(after.y);
  expect(passed.y + passed.height).toBeGreaterThan(after.y + after.height);

  // The pills are solid and take clicks, while the gaps beside them reach the script.
  const hit = await host(page).evaluate((el, at) => {
    const name = (x, y) => el.shadowRoot.elementFromPoint(x, y)?.closest('.fl-pill, .fl-sheet')?.className ?? '';
    return { gap: name(650, at.y), pill: name(at.bold.x + 5, at.bold.y + 5) };
  }, { x: after.x, y: after.y + 20, bold: await rib(page, 'Bold').boundingBox() });
  expect(hit.gap).toContain('fl-sheet');
  expect(hit.pill).toContain('fl-pill');
  const background = await page.locator('flow-script .fl-ribbon .fl-pill').first().evaluate((p) => getComputedStyle(p).backgroundColor);
  expect(background).toBe('rgb(238, 241, 234)');

  // Formatting still works while floating.
  await lineWith(page, 'Beat 50.').click();
  await chooseTopic(page, 'Scene');
  expect(await value(page)).toContain('.Beat 50.');
});

for (const view of ['Paged', 'Seamless', 'Fountain']) {
  test(`typing never hides the line under the floating row in ${view} view`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await open(page);
    await setValue(page, Array.from({ length: 120 }, (_, i) => `Beat ${i}.`).join('\n\n'));
    await chooseView(page, view);
    const scroll = page.locator('flow-script .fl-scroll');
    const row = page.locator('flow-script .fl-ribbon');
    await lineWith(page, 'Beat 60.').click();
    // Scroll the cursor's line to sit exactly beneath the row, then type.
    await page.waitForTimeout(100);
    await host(page).evaluate((el) => {
      const scroller = el.shadowRoot.querySelector('.fl-scroll');
      const line = [...el.shadowRoot.querySelectorAll('.fl-line')].find((l) => l.textContent === 'Beat 60.');
      scroller.scrollTop += line.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 10;
    });
    const rowBox = await row.boundingBox();
    expect((await lineWith(page, 'Beat 60.').boundingBox()).y).toBeLessThan(rowBox.y + rowBox.height);
    await page.keyboard.type('x');
    await expect.poll(async () => (await lineWith(page, 'Beat 60.x').boundingBox()).y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
}

test('a short script in continuous views needs no scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await open(page);
  await setValue(page, 'Short.');
  for (const view of ['Seamless', 'Fountain']) {
    await chooseView(page, view);
    await expect.poll(() => page.locator('flow-script .fl-scroll').evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);
  }
});

test('when narrow, labels give way to icons but the topic keeps its name', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  await expect(viewButton(page).locator('.fl-label')).toBeVisible();
  await page.setViewportSize({ width: 500, height: 800 });
  await expect(rib(page, 'Comment')).toBeVisible();
  await expect(viewButton(page).locator('.fl-label')).toBeHidden();
  await expect(page.locator('flow-script .fl-topic-name')).toBeVisible();
  // The pills wrap rather than pushing the page sideways.
  const overflow = await page.locator('flow-script .fl-ribbon').evaluate((r) => r.scrollWidth - r.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('scene continuation shows in read-only and on editor page breaks, from the PDF menu', async ({ page }) => {
  await open(page);
  const beats = Array.from({ length: 70 }, (_, i) => `Beat ${i}.`).join('\n');
  await setValue(page, `INT. A - DAY\n\n${beats}`);
  const dialog = await openExport(page);
  await dialog.getByText('Scene continued across pages').click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('flow-script .fl-page-gap').first()).toContainText('(CONTINUED)');
  await host(page).evaluate((el) => { el.readonly = true; });
  const pages = page.locator('flow-script .fl-page');
  await expect(pages.nth(0)).toContainText('(CONTINUED)');
  await expect(pages.nth(1)).toContainText('CONTINUED:');
});

test('menus stay on screen wherever their button lands', async ({ page }) => {
  await open(page);
  const expectOnScreen = async (popup, label) => {
    const viewport = page.viewportSize();
    const box = await popup.boundingBox();
    expect(box.x, label).toBeGreaterThanOrEqual(0);
    expect(box.y, label).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, label).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, label).toBeLessThanOrEqual(viewport.height);
  };
  const topicsPopup = page.locator('flow-script .fl-topics .fl-menu-popup');
  const viewPopup = statusbar(page).locator('.fl-pill:not([hidden]) .fl-menu-popup');
  for (const width of [1300, 900, 600, 390, 280]) {
    await page.setViewportSize({ width, height: 800 });
    await topicButton(page).click();
    await expect(topicsPopup).toBeVisible();
    await expectOnScreen(topicsPopup, `topics at ${width}px`);
    await topicButton(page).click();
    await expect(topicsPopup).toBeHidden();
    await viewButton(page).click();
    await expect(viewPopup).toBeVisible();
    await expectOnScreen(viewPopup, `views at ${width}px`);
    await viewButton(page).click();
  }
  // It follows a resize while open, and scrolls rather than running off a short window.
  await page.setViewportSize({ width: 800, height: 800 });
  await topicButton(page).click();
  await page.setViewportSize({ width: 800, height: 300 });
  await expect(() => expectOnScreen(topicsPopup, 'short window')).toPass({ timeout: 2000 });
  // It reaches over the bottom pills rather than being cut off behind them.
  const popupBox = await topicsPopup.boundingBox();
  const barBox = await statusbar(page).boundingBox();
  if (popupBox.y + popupBox.height > barBox.y) {
    const covering = await host(page).evaluate((el, at) => el.shadowRoot.elementFromPoint(at.x, at.y)?.closest('.fl-menu-popup') != null, { x: popupBox.x + 20, y: barBox.y + 10 });
    expect(covering).toBe(true);
  }
});

test('menus close on outside clicks and Escape, and work from the keyboard', async ({ page }) => {
  await open(page);
  await setValue(page, 'words here');
  await lineWith(page, 'words').click();
  const popup = page.locator('flow-script .fl-topics .fl-menu-popup');
  await topicButton(page).click();
  await expect(popup).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await topicButton(page).click();
  await page.locator('flow-script .fl-scroll').click({ position: { x: 5, y: 5 } });
  await expect(popup).toBeHidden();

  await lineWith(page, 'words').click();
  await topicButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(popup).toBeVisible();
  const focused = page.locator('flow-script .fl-menu-item:focus');
  await expect(focused).toHaveAttribute('aria-label', 'Action');
  await page.keyboard.press('ArrowUp');
  await expect(focused).toHaveAttribute('aria-label', 'Scene');
  await page.keyboard.press('Enter');
  await expect(popup).toBeHidden();
  expect(await value(page)).toBe('.words here');
});

test('the PDF button opens a modal of options that stays usable when small', async ({ page }) => {
  await open(page);
  const dialog = await openExport(page);
  await expect(dialog.getByText('Title page')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Export PDF' })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 300, height: 800 });
  const holder = page.locator('flow-script .fl-export-holder');
  await holder.getByRole('button', { name: 'Export', exact: true }).click();
  await holder.getByRole('menuitem', { name: 'PDF', exact: true }).click();
  await expect(page.locator('flow-script dialog').getByRole('button', { name: 'Export PDF' })).toBeInViewport({ ratio: 1 });
});

test('Read shows the printed pages with editing off, then returns intact', async ({ page }) => {
  await open(page);
  await setValue(page, 'Hello [[private]] world.\n\n/* cut */\n\nEnd.');
  await lineWith(page, 'End').click();
  await page.keyboard.press('End');
  await page.keyboard.type('X');
  await show(page, 'Read');
  await expect(host(page)).toHaveAttribute('workspace', 'read');
  await expect(host(page)).toHaveAttribute('view', 'page');
  await expect(editor(page)).toBeHidden();
  await expect(page.locator('flow-script .fl-page').first()).toBeVisible();
  await expect(page.locator('flow-script .fl-pages')).toContainText('End.X');
  await expect(page.locator('flow-script .fl-pages')).not.toContainText('cut');
  await expect(page.locator('flow-script .fl-ribbon')).toBeHidden();
  await page.keyboard.type('Y');
  expect(await value(page)).toContain('End.X');
  expect(await value(page)).not.toContain('Y');

  // Options and values keep the pages current.
  await setValue(page, 'Replaced.');
  await expect(page.locator('flow-script .fl-pages')).toContainText('Replaced.');
  await setValue(page, 'Hello.');

  await show(page, 'Paged');
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('flow-script .fl-pages')).toHaveCount(0);
  await expect(rib(page, 'Bold')).toBeVisible();
  await expect(editor(page)).toBeFocused(); // which follows on the next animation frame
  await page.keyboard.type('Z');
  expect(await value(page)).toContain('Z');
});

test('Read keeps undo history', async ({ page }) => {
  await open(page);
  await setValue(page, 'Hello.');
  await lineWith(page, 'Hello').click();
  await page.keyboard.press('End');
  await page.keyboard.type('A');
  await show(page, 'Read');
  await show(page, 'Paged');
  await expect(historyButton(page, 'Undo')).toBeEnabled();
  await historyButton(page, 'Undo').click();
  expect(await value(page)).toBe('Hello.');
});

test('the Fountain view shows the file exactly as written, and stays editable', async ({ page }) => {
  await open(page);
  const text = 'Title: BIG\n\nint. room - day\n\nShe **runs** [[a note]] /* cut */.\n\n@bob\nHi.\n\n===\n\nEnd.';
  await setValue(page, text);
  await lineWith(page, 'She').click();
  await chooseView(page, 'Fountain');
  await expect(host(page)).toHaveAttribute('view', 'source');

  // Every line is there as typed, with no formatting, bubbles, or page furniture.
  const lines = page.locator('flow-script .ProseMirror > .fl-line');
  expect(await lines.allTextContents()).toEqual(text.split('\n'));
  await expect(page.locator('flow-script .fl-source .fl-b')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-marker')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-bubble-chip')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-page-gap')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-active')).toHaveCount(0);
  await expect(lineWith(page, 'int. room')).toHaveCSS('text-transform', 'none');
  await expect(lineWith(page, 'BIG')).toHaveCSS('position', 'static');
  await expect(lineWith(page, 'bob')).toHaveCSS('margin-left', '0px');
  await expect(lineWith(page, 'She')).toHaveCSS('font-family', /^"Courier Prime"/);

  // It edits the same script, keeping the cursor and undo history across views.
  await page.keyboard.type('X');
  const edited = await value(page);
  expect(edited).not.toBe(text);
  await rib(page, 'Bold').click();
  expect(await value(page)).toContain('**');
  await chooseView(page, 'Paged');
  await expect(page.locator('flow-script .ProseMirror .fl-b').first()).toBeVisible();
  await expect(page.locator('flow-script .fl-page-gap').first()).toBeAttached();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await value(page)).toBe(text);
});

test('the view menu lists Seamless, Paged and Fountain, and Seamless is the default', async ({ page }) => {
  await open(page, { view: null });
  await expect(viewButton(page)).toHaveAttribute('aria-label', 'View: Seamless');
  await expect(page.locator('flow-script .fl-flow')).toBeVisible();
  await viewButton(page).click();
  const names = await statusbar(page).getByRole('menuitemradio').evaluateAll((items) => items.map((i) => i.getAttribute('aria-label')));
  expect(names).toEqual(['Seamless', 'Paged', 'Fountain']);
});

test('Read shows pages whichever view Write is in, and Write keeps its view', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await open(page, { view: 'flow' });
  await setValue(page, 'Hello.');
  await show(page, 'Read');
  expect((await page.locator('flow-script .fl-page').first().boundingBox()).width).toBeCloseTo(816, 0);
  // Only Read's own view menu shows, set to Paged.
  await expect(viewButton(page)).toHaveAttribute('aria-label', 'View: Paged');
  await host(page).evaluate((el) => el.setAttribute('workspace', 'write'));
  await expect(page.locator('flow-script .fl-flow')).toBeVisible();
  await expect(page.locator('flow-script .fl-read')).toHaveCount(0);
});

test('the Fountain view works read-only and follows the page scale', async ({ page }) => {
  await open(page);
  const text = 'She **runs** [[a note]].\n\nEnd.';
  await setValue(page, text);
  await host(page).evaluate((el) => { el.view = 'source'; el.scale = 150; });
  await expect(page.locator('flow-script .fl-source')).toHaveCSS('font-size', '24px');
  await host(page).evaluate((el) => { el.readonly = true; });
  const shown = page.locator('flow-script pre.fl-source');
  await expect(shown).toHaveText(text, { useInnerText: true });
  await expect(shown).toHaveCSS('font-size', '24px');
});

test('page scale resizes every view and stops at its limits', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await open(page);
  const sheet = page.locator('flow-script .fl-sheet');
  const larger = statusbar(page).getByRole('button', { name: 'Larger' });
  const smaller = statusbar(page).getByRole('button', { name: 'Smaller' });
  const percent = page.locator('flow-script .fl-scale');
  await expect(percent).toHaveText('100%');
  expect((await sheet.boundingBox()).width).toBeCloseTo(816, 0);
  await host(page).evaluate((el) => { window.scales = []; el.addEventListener('flow-scale', (e) => window.scales.push(e.detail.scale)); });
  await larger.click();
  await expect(percent).toHaveText('110%');
  expect((await sheet.boundingBox()).width).toBeCloseTo(816 * 1.1, 0);
  expect(await page.evaluate(() => window.scales)).toEqual([110]);

  await show(page, 'Read');
  expect((await page.locator('flow-script .fl-page').first().boundingBox()).width).toBeCloseTo(816 * 1.1, 0);
  await show(page, 'Seamless');
  await expect(page.locator('flow-script .fl-flow')).toHaveCSS('font-size', '17.6px');

  await host(page).evaluate((el) => { el.scale = 60; });
  await smaller.click();
  await expect(percent).toHaveText('50%');
  await expect(smaller).toBeDisabled();
  await host(page).evaluate((el) => { el.scale = 500; });
  await expect(percent).toHaveText('200%');
  await expect(larger).toBeDisabled();
});

test('clicking the percentage resets the page scale', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await open(page);
  const percent = page.locator('flow-script .fl-scale');
  const sheet = page.locator('flow-script .fl-sheet');
  await statusbar(page).getByRole('button', { name: 'Larger' }).click();
  await statusbar(page).getByRole('button', { name: 'Larger' }).click();
  await expect(percent).toHaveText('120%');
  await host(page).evaluate((el) => { window.scales = []; el.addEventListener('flow-scale', (e) => window.scales.push(e.detail.scale)); });
  await percent.click();
  await expect(percent).toHaveText('100%');
  expect((await sheet.boundingBox()).width).toBeCloseTo(816, 0);
  expect(await page.evaluate(() => window.scales)).toEqual([100]);
  await expect(percent).toHaveAttribute('aria-label', 'Page scale 100%. Reset to 100%');
});

test('a page too big for the window can still be scrolled to both edges', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await open(page);
  await host(page).evaluate((el) => { el.scale = 200; el.workspace = 'read'; });
  const scroll = page.locator('flow-script .fl-scroll');
  const first = page.locator('flow-script .fl-page').first();
  await expect(first).toBeVisible();
  await scroll.evaluate((s) => { s.scrollLeft = 0; });
  const scrollBox = await scroll.boundingBox();
  expect((await first.boundingBox()).x).toBeGreaterThanOrEqual(scrollBox.x);
});

test('apps can fill the top row and status bar through slots', async ({ page }) => {
  await open(page);
  await host(page).evaluate((el) => {
    for (const [slot, text] of [['document', 'Doc'], ['tabs', 'Tabs'], ['status-end', 'End']]) {
      const span = document.createElement('span');
      span.slot = slot;
      span.textContent = text;
      el.append(span);
    }
  });
  const doc = await host(page).getByText('Doc', { exact: true }).boundingBox();
  const tabs = await host(page).getByText('Tabs', { exact: true }).boundingBox();
  const pdf = await page.locator('flow-script .fl-export').getByRole('button', { name: 'PDF', exact: true }).boundingBox();
  expect(doc.x).toBeLessThan(tabs.x);
  expect(tabs.x).toBeLessThan(pdf.x);
  const end = await host(page).getByText('End', { exact: true }).boundingBox();
  const bar = await statusbar(page).boundingBox();
  expect(end.y).toBeGreaterThanOrEqual(bar.y);
  // Slotted content must not turn into script text.
  expect(await value(page)).not.toContain('Doc');
});

test('export actions show as buttons, then collapse into a vertical menu with PDF', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  const exportPill = page.locator('flow-script .fl-export');
  const more = page.locator('flow-script .fl-export-holder').getByRole('button', { name: 'Export', exact: true });
  await expect(exportPill.locator('.fl-pill-sep')).toHaveCount(0);
  await host(page).evaluate((el) => {
    window.ran = [];
    el.exportActions = [{ label: 'Keep', icon: 'save', onClick: () => window.ran.push('keep') }];
  });
  await expect(exportPill.locator('.fl-pill-sep')).toHaveCount(1);
  await exportPill.getByRole('button', { name: 'Keep', exact: true }).click();
  expect(await page.evaluate(() => window.ran)).toEqual(['keep']);
  await expect(more).toBeHidden();

  await page.setViewportSize({ width: 500, height: 800 });
  await expect(exportPill).toBeHidden();
  await expect(more).toBeVisible();
  await more.click();
  const holder = page.locator('flow-script .fl-export-holder');
  await expect(holder.getByRole('menuitem')).toHaveCount(3); // Keep, PDF and Settings
  await holder.getByRole('menuitem', { name: 'Keep', exact: true }).click();
  expect(await page.evaluate(() => window.ran)).toEqual(['keep', 'keep']);
  await more.click();
  await holder.getByRole('menuitem', { name: 'PDF', exact: true }).click();
  await expect(page.locator('flow-script dialog')).toBeVisible();
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
  await expect(rib(page, 'Comment')).toHaveAttribute('aria-pressed', 'false');
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
  await rib(page, 'Bold').click();
  await rib(page, 'Italic').click();
  expect(await value(page)).toBe('***word***');
  await historyButton(page, 'Undo').click();
  expect(await value(page)).toBe('**word**');
  await historyButton(page, 'Undo').click();
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
  await bundledFontLoaded(page);
  const m = await host(page).evaluate((el) => {
    const cell = [...el.shadowRoot.querySelectorAll('.fl-cell')].find((c) => c.textContent.length > 20);
    const r = document.createRange();
    r.selectNodeContents(cell);
    return { width: r.getBoundingClientRect().width, chars: cell.textContent.length };
  });
  expect(m.width / m.chars).toBeCloseTo(9.6, 1);
});

test('the bundled Courier Prime faces load and are used', async ({ page }) => {
  await open(page);
  await bundledFontLoaded(page);
});

test('editor wraps at the same column as the printed page', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page);
  const longLine = 'word '.repeat(30).trim();
  await setValue(page, longLine);
  await bundledFontLoaded(page);
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
  await chooseView(page, 'Seamless');
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
  await chooseView(page, 'Seamless');
  await page.keyboard.type('B');
  expect(await value(page)).toBe('Hello.AB');
  await chooseView(page, 'Paged');
  await historyButton(page, 'Undo').click();
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
  await expect(paper()).toHaveCSS('background-color', 'rgb(246, 248, 244)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sage-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(38, 41, 40)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sea-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sea-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(34, 40, 43)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'romance-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(250, 246, 239)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'romance-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(43, 34, 38)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'forest-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(251, 248, 239)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'forest-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(41, 40, 36)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sand-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(252, 246, 238)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sand-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(42, 39, 36)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'lavender-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(248, 243, 240)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'lavender-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(38, 37, 44)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'graphite-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(247, 247, 248)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'graphite-dark'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(34, 35, 38)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sepia'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(244, 236, 216)');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sage-light'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(246, 248, 244)');
  await host(page).evaluate((el) => el.style.setProperty('--flow-paper', 'rgb(1, 2, 3)'));
  await expect(paper()).toHaveCSS('background-color', 'rgb(1, 2, 3)');
});

test('auto themes follow the system setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const paper = page.locator('flow-script .fl-sheet');
  await host(page).evaluate((el) => el.setAttribute('theme', 'sea-auto'));
  await expect(paper).toHaveCSS('background-color', 'rgb(34, 40, 43)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(paper).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('component tokens can be overridden from CSS or a registered theme', async ({ page }) => {
  await open(page);
  const pillEl = page.locator('flow-script .fl-ribbon .fl-pill').first();
  const tabsOrExport = page.locator('flow-script .fl-export');
  await expect(pillEl).toHaveCSS('background-color', 'rgb(238, 241, 234)');
  await expect(pillEl).toHaveCSS('border-top-left-radius', '999px');

  // Tokens set from the page's own CSS reach inside the shadow root.
  const overrides = await page.addStyleTag({ content: 'flow-script { --flow-pill-bg: rgb(1, 2, 3); --flow-pill-radius: 4px; }' });
  await expect(pillEl).toHaveCSS('background-color', 'rgb(1, 2, 3)');
  await expect(tabsOrExport).toHaveCSS('border-top-left-radius', '4px');
  await overrides.evaluate((tag) => tag.remove());

  // So do tokens in a registered theme.
  await host(page).evaluate((el) => el.setAttribute('theme', 'sepia'));
  await expect(pillEl).toHaveCSS('border-top-left-radius', '8px');
});

test('editor page breaks line up with the printed pages', async ({ page }) => {
  await open(page);
  const body = Array.from({ length: 150 }, (_, i) => `Action ${i}.\n`).join('\n');
  await setValue(page, body);
  const pageCount = await host(page).evaluate((el) => el.pageCount);
  await expect(page.locator('flow-script .fl-page-gap')).toHaveCount(pageCount - 1);
  await chooseView(page, 'Seamless');
  await expect(page.locator('flow-script .fl-page-gap').first()).toBeHidden();
});

test('headings after a page break appear on the new page in the editor', async ({ page }) => {
  await open(page);
  await setValue(page, 'One.\n\n===\n\n# Act Two\n\n= Summary.\n\n## The Storm\n\nINT. A - DAY\n\nAction.');
  await expect(page.locator('flow-script .fl-page-gap')).toHaveCount(1);
  const order = await page.locator('flow-script .ProseMirror > :not(.fl-page-one)').evaluateAll((els) => els.map((e) => (e.classList.contains('fl-page-gap') ? 'GAP' : e.textContent)).filter(Boolean));
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
  await expect(gap).toHaveText('1.');
  const paged = await gap.boundingBox();
  expect(paged.height).toBeGreaterThan(20);
  const order = await page.locator('flow-script .ProseMirror > *').evaluateAll((els) => els.map((e) => (e.classList.contains('fl-title-gap') ? 'GAP' : e.textContent)).filter(Boolean));
  expect(order.slice(0, 3)).toEqual(['Title: BIG', 'GAP', '# Act One']);

  await chooseView(page, 'Seamless');
  await expect(gap).toBeVisible();
  await expect(gap).toHaveCSS('border-top-style', 'dashed');
  expect((await gap.boundingBox()).height).toBeLessThan(5);

  await host(page).evaluate((el) => { el.readonly = true; });
  await expect(page.locator('flow-script .fl-flow .fl-break-rule')).toHaveCount(2);
  await expect(page.locator('flow-script .fl-flow')).not.toContainText('===');
});

test('page view shows the cover page as a full page, spaced like print', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page);
  await setValue(page, 'Title: BIG\nCredit: by\nAuthor: Me\nSource: A book\nContact:\n    a@b.c\nNotes: Hi\n\nAction here.');
  const sheet = await page.locator('flow-script .fl-sheet').boundingBox();
  const topOf = async (text) => (await lineWith(page, text).boundingBox()).y - sheet.y;
  const row = 16;
  // 1in margin plus row 15, then two blank rows between each topic.
  expect(await topOf('BIG')).toBeCloseTo((6 + 15) * row, 0);
  expect(await topOf('by')).toBeCloseTo((6 + 18) * row, 0);
  expect(await topOf('Me')).toBeCloseTo((6 + 21) * row, 0);
  expect(await topOf('A book')).toBeCloseTo((6 + 24) * row, 0);
  // Contact sits at the foot of the page's text area, on the right.
  expect(await topOf('a@b.c')).toBeCloseTo((6 + 54) * row, 0);
  expect((await lineWith(page, 'a@b.c').boundingBox()).x - sheet.x).toBeGreaterThan(300);
  expect((await lineWith(page, 'Hi').boundingBox()).x - sheet.x).toBeCloseTo(9 * row, 0);
  const big = await lineWith(page, 'BIG').boundingBox();
  expect(big.x + big.width / 2 - sheet.x).toBeCloseTo(408, 0);

  // The script then starts on the next page, after exactly one page's height.
  const gap = page.locator('flow-script .fl-title-gap');
  await expect(gap).toBeAttached();
  expect((await gap.boundingBox()).y - sheet.y).toBeCloseTo(1056, 0);
  expect(await topOf('Action here')).toBeGreaterThan(1056);

  // Editing a field in place still works.
  await lineWith(page, 'Me').click();
  await page.keyboard.press('End');
  await page.keyboard.type('lody');
  expect(await value(page)).toContain('Author: Melody');
  expect((await lineWith(page, 'Melody').boundingBox()).y - sheet.y).toBeCloseTo((6 + 21) * row, 0);

  // Flow view returns to plain lines.
  await chooseView(page, 'Seamless');
  await expect(lineWith(page, 'BIG')).toHaveCSS('position', 'static');
});

test('paged view numbers page 1 on screen, while print leaves it unnumbered', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  const body = Array.from({ length: 150 }, (_, i) => `Action ${i}.`).join('\n\n');

  // With no title page, it sits at the top right of the sheet, without moving the text.
  await setValue(page, body);
  const number = page.locator('flow-script .fl-page-one');
  await expect(number).toHaveText('1.');
  await expect(number).toBeVisible();
  const sheet = await page.locator('flow-script .fl-sheet').boundingBox();
  const box = await number.boundingBox();
  expect(box.x + box.width).toBeGreaterThan(sheet.x + sheet.width - 30);
  expect(box.y).toBeLessThan(sheet.y + 40);
  expect((await lineWith(page, 'Action 0.').boundingBox()).y - sheet.y).toBeCloseTo(96, 0);
  expect(await value(page)).toBe(body);

  // Other views don't have it, and the printed page 1 stays unnumbered.
  await chooseView(page, 'Seamless');
  await expect(number).toBeHidden();
  await chooseView(page, 'Fountain');
  await expect(number).toHaveCount(0);
  await show(page, 'Read');
  await expect(page.locator('flow-script .fl-page[data-page="1"] .fl-page-number')).toHaveCount(0);
  await expect(page.locator('flow-script .fl-page[data-page="2"] .fl-page-number')).toHaveCount(1);
  await show(page, 'Paged');

  // With a title page, it's in the break after the cover, like every later number.
  await setValue(page, `Title: BIG\n\n${body}`);
  await expect(page.locator('flow-script .fl-title-gap')).toHaveText('1.');
  await expect(number).toHaveCount(0);
  await chooseView(page, 'Seamless');
  await expect(page.locator('flow-script .fl-title-gap span')).toBeHidden();
});

test('a cover page with no script yet still fills a page', async ({ page }) => {
  await open(page);
  await setValue(page, 'Title: BIG');
  await expect(page.locator('flow-script .fl-title-gap')).toBeAttached();
  const sheet = await page.locator('flow-script .fl-sheet').boundingBox();
  expect((await page.locator('flow-script .fl-title-gap').boundingBox()).y - sheet.y).toBeCloseTo(1056, 0);
});

test('turning the title page off lets its lines flow normally', async ({ page }) => {
  await open(page);
  await setValue(page, 'Title: BIG\n\nAction.');
  await expect(lineWith(page, 'BIG')).toHaveCSS('position', 'absolute');
  await host(page).evaluate((el) => { el.printOptions = { titlePage: false }; });
  await expect(lineWith(page, 'BIG')).toHaveCSS('position', 'static');
  await expect(page.locator('flow-script .fl-title-gap')).toHaveCount(0);
});

test('an app can restyle the interface font', async ({ page }) => {
  await open(page);
  const ribbon = page.locator('flow-script .fl-ribbon');
  await host(page).evaluate((el) => el.style.setProperty('--flow-ui-font', 'Georgia'));
  await expect(ribbon).toHaveCSS('font-family', 'Georgia');
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

test('PDF exports from the modal as a real file', async ({ page }) => {
  await open(page);
  const dialog = await openExport(page);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('THE LAST LIGHTHOUSE.pdf');
  await file.saveAs(`${process.env.FLOW_OUT ?? 'test-results'}/sample.pdf`);
  await expect(page.locator('flow-script .fl-status')).toContainText('Exported');
  await expect(dialog).toHaveCount(0);
});

test('a title on several lines is joined with dashes in the PDF file name', async ({ page }) => {
  await open(page);
  await setValue(page, 'Title:\n    The Long\n    Way Home\n\nAction.');
  const dialog = await openExport(page);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /export|download|pdf/i }).first().click();
  expect((await download).suggestedFilename()).toBe('The Long - Way Home.pdf');
});

test('PDF export embeds Courier Prime, matching the screen', async ({ page }) => {
  await open(page);
  const size = await host(page).evaluate(async (el) => (await el.exportPdf()).blob.size);
  // The built-in Courier adds nothing to a file, so an embedded font shows in its size.
  expect(size).toBeGreaterThan(5000);
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
  await host(page).evaluate((el) => el.setAttribute('theme', 'sage-dark'));
  await page.screenshot({ path: `${out}/edit-page-dark.png` });
  await chooseView(page, 'Seamless');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/edit-flow-dark.png` });
  await host(page).evaluate((el) => { el.setAttribute('theme', 'sage-light'); el.view = 'page'; el.readonly = true; });
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

test.describe('outline tab', () => {
  const tool = (page, name) => page.locator('flow-script .fl-ribbon').getByRole('button', { name: `Add ${name}`, exact: true });
  const fields = (page) => page.locator('flow-script .fl-outline-field');
  const selectedCards = (page) => page.locator('flow-script .fl-outline-selected');
  const setWorkspace = (page, workspace) => host(page).evaluate((el, w) => el.setAttribute('workspace', w), workspace);
  const openOutline = async (page, script = '') => {
    await open(page);
    await setValue(page, script);
    await setWorkspace(page, 'outline');
    await expect(tool(page, 'act')).toBeVisible();
  };
  const block = (page, text) => page.locator('flow-script .fl-outline-block', { hasText: text });
  const dragHandle = async (page, handle, target, edge = 'top') => {
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8);
    await page.mouse.move(to.x + 40, edge === 'top' ? to.y - 2 : to.y + to.height + 2, { steps: 6 });
    return { drop: () => page.mouse.up() };
  };
  // The outline's own padding, where there's no card.
  const pressBetweenCards = (page) => page.locator('flow-script .fl-outline').click({ position: { x: 4, y: 4 } });

  test('acts and sequences fold away with the chevron on their right, and stay folded through edits', async ({ page }) => {
    await openOutline(page, '# One\n\n## Chase\n\nINT. A - DAY\n\nINT. B - DAY\n\n# Two\n\nINT. C - DAY\n');
    const act = page.locator('flow-script .fl-outline-list > .fl-outline-card').first();
    const fold = act.locator(':scope > .fl-outline-row > .fl-outline-fold');
    // On the right, past the title and the remove button.
    const heading = await act.locator(':scope > .fl-outline-row .fl-outline-field').boundingBox();
    expect((await fold.boundingBox()).x).toBeGreaterThan(heading.x + heading.width);
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
    await expect(block(page, 'INT. A')).toBeVisible();
    await fold.click();
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(block(page, 'INT. A')).toBeHidden();
    await expect(act.locator(':scope > .fl-outline-row > .fl-outline-count')).toHaveText('2 scenes');
    await expect(block(page, 'INT. C')).toBeVisible();
    // An edit elsewhere redraws the outline, and the act stays folded.
    await host(page).evaluate((el) => { el.value = `Opening.\n\n${el.value}`; });
    await expect(block(page, 'INT. A')).toBeHidden();
    await expect(page.locator('flow-script .fl-outline-list > .fl-outline-card').first().locator(':scope > .fl-outline-row > .fl-outline-fold')).toHaveAttribute('aria-expanded', 'false');
    // A sequence folds on its own, inside an open act.
    await page.locator('flow-script .fl-outline-list > .fl-outline-card').first().locator(':scope > .fl-outline-row > .fl-outline-fold').click();
    const sequence = page.locator('flow-script .fl-outline-card .fl-outline-card').first();
    await sequence.locator(':scope > .fl-outline-row > .fl-outline-fold').click();
    await expect(block(page, 'INT. B')).toBeHidden();
    await expect(sequence.locator(':scope > .fl-outline-row > .fl-outline-field')).toBeVisible();
  });

  test('a block dragged onto a folded card is outlined there, then lands at its top and opens it', async ({ page }) => {
    await openOutline(page, '# One\n\nINT. A - DAY\n\n# Two\n\n## Chase\n\nINT. C - DAY\n\nINT. D - DAY\n');
    const two = page.locator('flow-script .fl-outline-list > .fl-outline-card').nth(1);
    await two.locator(':scope > .fl-outline-row > .fl-outline-fold').click();
    await expect(block(page, 'INT. C')).toBeHidden();
    const handle = block(page, 'INT. A').locator('.fl-outline-grip');
    const from = await handle.boundingBox();
    const to = await two.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
    await expect(two).toHaveClass(/fl-outline-drop-into/);
    await expect(page.locator('flow-script .fl-outline-drop')).toBeHidden();
    await page.mouse.up();
    await expect(page.locator('flow-script .fl-outline-drop-into')).toHaveCount(0);
    // It goes in first, ahead of the sequence, and the act opens to show it.
    expect(await value(page)).toBe('# One\n\n# Two\n\nINT. A - DAY\n\n## Chase\n\nINT. C - DAY\n\nINT. D - DAY\n');
    const reopened = page.locator('flow-script .fl-outline-list > .fl-outline-card').nth(1);
    await expect(reopened.locator(':scope > .fl-outline-row > .fl-outline-fold')).toHaveAttribute('aria-expanded', 'true');
    await expect(block(page, 'INT. A')).toBeVisible();

    // A new card from the tools goes in the same way.
    const chase = page.locator('flow-script .fl-outline-card .fl-outline-card').first();
    await chase.locator(':scope > .fl-outline-row > .fl-outline-fold').click();
    await expect(block(page, 'INT. C')).toBeHidden();
    const tile = await tool(page, 'synopsis').boundingBox();
    const target = await chase.boundingBox();
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.mouse.down();
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2 + 20);
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await expect(chase).toHaveClass(/fl-outline-drop-into/);
    await page.mouse.up();
    expect(await value(page)).toBe('# One\n\n# Two\n\nINT. A - DAY\n\n## Chase\n=\n\nINT. C - DAY\n\nINT. D - DAY\n');
    await expect(block(page, 'INT. C')).toBeVisible();
  });

  test('the tools add an act and a synopsis below it, and a sequence takes the synopsis in', async ({ page }) => {
    await openOutline(page);
    await expect(page.locator('flow-script .fl-outline-hint')).toContainText('Outline your screenplay here.');
    await expect(page.locator('flow-script .fl-outline-hint')).toContainText('drag');
    await tool(page, 'act').click();
    await expect(page.locator('flow-script .fl-outline-hint')).toBeHidden();
    await page.keyboard.type('Act One');
    await tool(page, 'synopsis').click();
    await page.keyboard.type('The setup');
    await tool(page, 'sequence').click();
    await page.keyboard.type('Morning');
    expect(await value(page)).toBe('# Act One\n\n## Morning\n= The setup');
    await expect(page.locator('flow-script .fl-outline-card .fl-outline-card')).toHaveCount(1);
  });

  test('with nothing selected, each tool adds at the very end', async ({ page }) => {
    await openOutline(page, '# A\n\nINT. X - DAY\n\n# B\n\nINT. Y - DAY');
    await expect(selectedCards(page)).toHaveCount(0);
    await tool(page, 'synopsis').click();
    await page.keyboard.type('s');
    await pressBetweenCards(page);
    await tool(page, 'sequence').click();
    await page.keyboard.type('S');
    expect(await value(page)).toBe('# A\n\nINT. X - DAY\n\n# B\n\nINT. Y - DAY\n= s\n\n## S');
  });

  test('a new act goes after the selected act, and a sequence or synopsis under it, past its synopses', async ({ page }) => {
    await openOutline(page, '# A\n= a\n\nINT. X - DAY\n\n# B');
    await fields(page).first().click();
    await expect(selectedCards(page)).toHaveCount(1);
    await tool(page, 'act').click();
    await page.keyboard.type('New');
    expect(await value(page)).toBe('# A\n= a\n\nINT. X - DAY\n\n# New\n\n# B');

    await fields(page).first().click();
    await tool(page, 'sequence').click();
    await page.keyboard.type('S');
    expect(await value(page)).toBe('# A\n= a\n\n## S\n\nINT. X - DAY\n\n# New\n\n# B');

    await fields(page).first().click();
    await tool(page, 'synopsis').click();
    await page.keyboard.type('b');
    expect(await value(page)).toBe('# A\n= a\n= b\n\n## S\n\nINT. X - DAY\n\n# New\n\n# B');
  });

  test('a selected scene gets the new card right below it', async ({ page }) => {
    await openOutline(page, '# A\n\nINT. X - DAY\n\nINT. Y - DAY');
    await block(page, 'INT. X').locator('.fl-outline-block-text').click();
    await expect(block(page, 'INT. X')).toHaveClass(/fl-outline-selected/);
    await tool(page, 'synopsis').click();
    await page.keyboard.type('x');
    expect(await value(page)).toBe('# A\n\nINT. X - DAY\n= x\n\nINT. Y - DAY');
    await expect(selectedCards(page)).toHaveClass(/fl-outline-synopsis/);
  });

  test('Act with a card inside an act selected splits the act there', async ({ page }) => {
    await openOutline(page, '# X\n\n## A\n\n## B\n\n## C');
    await fields(page).nth(2).click();
    await tool(page, 'act').click();
    await page.keyboard.type('Y');
    expect(await value(page)).toBe('# X\n\n## A\n\n# Y\n\n## B\n\n## C');

    // A synopsis at the top of an act goes with the new one too.
    await setValue(page, '# X\n= s\n\n## A');
    await page.locator('flow-script .fl-outline-synopsis .fl-outline-field').click();
    await tool(page, 'act').click();
    await page.keyboard.type('Y');
    expect(await value(page)).toBe('# X\n\n# Y\n= s\n\n## A');

    // An act selected at the top level still gets the new one after it.
    await fields(page).first().click();
    await tool(page, 'act').click();
    await page.keyboard.type('Z');
    expect(await value(page)).toBe('# X\n\n# Z\n\n# Y\n= s\n\n## A');
  });

  test('Sequence with a card inside a sequence selected splits the sequence there', async ({ page }) => {
    await openOutline(page, '# X\n\n## A\n\nINT. ONE - DAY\n\nINT. TWO - DAY');
    await block(page, 'INT. TWO').locator('.fl-outline-block-text').click();
    await tool(page, 'sequence').click();
    await page.keyboard.type('B');
    expect(await value(page)).toBe('# X\n\n## A\n\nINT. ONE - DAY\n\n## B\n\nINT. TWO - DAY');

    // A scene straight under an act can belong to a sequence too, so the new one takes it in.
    await setValue(page, '# X\n\nINT. ONE - DAY\n\nINT. TWO - DAY');
    await block(page, 'INT. ONE').locator('.fl-outline-block-text').click();
    await tool(page, 'sequence').click();
    await page.keyboard.type('B');
    expect(await value(page)).toBe('# X\n\n## B\n\nINT. ONE - DAY\n\nINT. TWO - DAY');
  });

  test('a new act takes in the selected sequence and those after it, even outside any act', async ({ page }) => {
    await openOutline(page, '## A\n\n## B\n\n## C\n\n## D\n\n## E\n\n## G');
    await fields(page).nth(2).click();
    await tool(page, 'act').click();
    await page.keyboard.type('One');
    expect(await value(page)).toBe('## A\n\n## B\n\n# One\n\n## C\n\n## D\n\n## E\n\n## G');
    const act = page.locator('flow-script .fl-outline-list > .fl-outline-card').last();
    expect(await act.locator('.fl-outline-card .fl-outline-field').evaluateAll((all) => all.map((f) => f.value))).toEqual(['C', 'D', 'E', 'G']);
  });

  test('pointing at a tool shows where it would add, in the secondary color', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# X\n\n## A\n\n## B\n\n## C');
    const preview = page.locator('flow-script .fl-outline-preview');
    await expect(preview).toBeHidden();

    // Nothing selected: the end of the script.
    await tool(page, 'act').hover();
    await expect(preview).toBeVisible();
    const last = await page.locator('flow-script .fl-outline-card .fl-outline-card').last().boundingBox();
    expect((await preview.boundingBox()).y).toBeGreaterThan(last.y + last.height - 2);
    await page.mouse.move(640, 700);
    await expect(preview).toBeHidden();

    // B selected: the new act would start at B.
    await fields(page).nth(2).click();
    await tool(page, 'act').hover();
    const b = await page.locator('flow-script .fl-outline-card .fl-outline-card').nth(1).boundingBox();
    const line = await preview.boundingBox();
    expect(Math.abs(line.y + line.height / 2 - b.y)).toBeLessThan(6);
    const secondary = await host(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--flow-secondary').trim());
    expect(secondary).toBe('#b0645a');
    await expect(preview).toHaveCSS('background-color', 'rgb(176, 100, 90)');

    await tool(page, 'act').click();
    await expect(preview).toBeHidden();
  });

  test('a tap that wanders a little is still a tap on a touch screen', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, baseURL: 'http://localhost:4178' });
    const page = await context.newPage();
    await openOutline(page, '# A');
    const box = await tool(page, 'act').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 5, y: y + 6 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => value(page)).toBe('# A\n\n#');
    await context.close();
  });

  test('pressing between the cards, or Escape, selects nothing', async ({ page }) => {
    await openOutline(page, '# A\n\n# B');
    await fields(page).first().click();
    await expect(selectedCards(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(selectedCards(page)).toHaveCount(0);
    await fields(page).first().click();
    await expect(selectedCards(page)).toHaveCount(1);
    await pressBetweenCards(page);
    await expect(selectedCards(page)).toHaveCount(0);
    await tool(page, 'act').click();
    await page.keyboard.type('C');
    expect(await value(page)).toBe('# A\n\n# B\n\n# C');
  });

  test('a tool dragged into the outline adds its card where it lands, and not over the bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const script = '# A\n\nINT. X - DAY\n\n# B';
    await openOutline(page, script);

    // A drag that never leaves the action center adds nothing, and isn't a click either.
    const act = await tool(page, 'act').boundingBox();
    await page.mouse.move(act.x + act.width / 2, act.y + act.height / 2);
    await page.mouse.down();
    await page.mouse.move(act.x + act.width / 2 + 40, act.y + act.height / 2, { steps: 4 });
    await expect(page.locator('flow-script .fl-outline-drop')).toBeHidden();
    await page.mouse.up();
    expect(await value(page)).toBe(script);

    const firstCard = page.locator('flow-script .fl-outline-list > .fl-outline-card').first();
    const { drop } = await dragHandle(page, tool(page, 'synopsis'), firstCard);
    await expect(page.locator('flow-script .fl-outline-drop')).toBeVisible();
    await expect(page.locator('flow-script .fl-outline-ghost')).toContainText('New synopsis');
    await drop();
    await page.keyboard.type('Top');
    expect(await value(page)).toBe('= Top\n\n# A\n\nINT. X - DAY\n\n# B');
    await expect(page.locator('flow-script .fl-outline-list > .fl-outline-synopsis')).toHaveCount(1);

    const { drop: dropSequence } = await dragHandle(page, tool(page, 'sequence'), block(page, 'INT. X'));
    await dropSequence();
    await page.keyboard.type('S');
    expect(await value(page)).toBe('= Top\n\n# A\n\n## S\n\nINT. X - DAY\n\n# B');
  });

  test('typing keeps the cursor in its card, including across spaces', async ({ page }) => {
    await openOutline(page, '# A\n\nAction.');
    await fields(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('ct one is here');
    await expect(fields(page).first()).toBeFocused();
    expect(await value(page)).toBe('# Act one is here\n\nAction.');
  });

  test('removing an act leaves the script, and its synopsis joins the act above', async ({ page }) => {
    await openOutline(page, '# Keep\n\n# Gone\n= Survives\n\nINT. HOUSE - DAY\n\nAction.');
    await fields(page).nth(1).hover();
    await page.getByRole('button', { name: 'Remove act' }).nth(1).click();
    expect(await value(page)).toBe('# Keep\n\n= Survives\n\nINT. HOUSE - DAY\n\nAction.');
    await expect(fields(page)).toHaveCount(2);
    await expect(fields(page).first()).toHaveValue('Keep');
    await expect(page.locator('flow-script .fl-outline-card .fl-outline-synopsis .fl-outline-field')).toHaveValue('Survives');
    await expect(page.locator('flow-script .fl-outline')).toBeFocused();
    await expect(selectedCards(page)).toHaveCount(0);
  });

  test('synopses and sequences above the first act stay at the top level', async ({ page }) => {
    await openOutline(page, '= My synopsis\n## A sequence\n# My act\n= Of the act');
    const top = page.locator('flow-script .fl-outline-list > *');
    await expect(top).toHaveCount(3);
    await expect(top.nth(0)).toHaveClass(/fl-outline-synopsis/);
    await expect(top.nth(1).locator('.fl-outline-field').first()).toHaveValue('A sequence');
    await expect(top.nth(2).locator('.fl-outline-synopsis .fl-outline-field')).toHaveValue('Of the act');
  });

  test('undo and redo work across both tabs, from the keyboard and the footer', async ({ page }) => {
    await openOutline(page, '# A');
    await fields(page).first().hover();
    await page.getByRole('button', { name: 'Remove act' }).click();
    expect(await value(page)).toBe('');
    await page.keyboard.press('Control+z');
    expect(await value(page)).toBe('# A');
    await expect(fields(page).first()).toHaveValue('A');
    await historyButton(page, 'Redo').click();
    expect(await value(page)).toBe('');
    await historyButton(page, 'Undo').click();
    await fields(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('bc');
    await expect(fields(page).first()).toHaveValue('Abc');
    await page.keyboard.press('Control+z');
    await expect(fields(page).first()).toHaveValue('A');
    await expect(fields(page).first()).toBeFocused();
  });

  test('Enter moves on, and pasted line breaks stay on one line', async ({ page }) => {
    await openOutline(page, '# A\n= s');
    await fields(page).first().click();
    await page.keyboard.press('Enter');
    await expect(fields(page).nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tool(page, 'act')).toBeFocused();
    await fields(page).nth(1).evaluate((el) => {
      el.value = 'one\ntwo';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await value(page)).toBe('# A\n= one two');
  });

  test('a long synopsis grows its card instead of scrolling inside it', async ({ page }) => {
    await openOutline(page, '# A\n= s');
    const field = fields(page).nth(1);
    const before = (await field.boundingBox()).height;
    await field.fill('word '.repeat(80));
    expect((await field.boundingBox()).height).toBeGreaterThan(before * 2);
    const [content, box] = await field.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(content).toBeLessThanOrEqual(box + 1);
  });

  test('the action center swaps formatting for the tools, and the view steps aside', async ({ page }) => {
    await open(page);
    await setWorkspace(page, 'outline');
    await expect(rib(page, 'Bold')).toHaveCount(0);
    await expect(tool(page, 'act')).toBeVisible();
    await expect(page.locator('flow-script .fl-ribbon')).toHaveAttribute('aria-label', 'Outline');
    await expect(viewButton(page)).toBeHidden();
    await expect(editor(page)).toBeHidden();
    await expect(historyButton(page, 'Undo')).toBeVisible();
    await setWorkspace(page, 'write');
    await expect(rib(page, 'Bold')).toBeVisible();
    await expect(tool(page, 'act')).toHaveCount(0);
    await expect(viewButton(page)).toBeVisible();
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('flow-script .fl-outline')).toBeHidden();
  });

  test('stays in step when the script is replaced from outside', async ({ page }) => {
    await openOutline(page, '# A');
    await setValue(page, '# B\n\n# C');
    await expect(fields(page)).toHaveCount(2);
    await expect(fields(page).first()).toHaveValue('B');
  });

  test('shows scenes and transitions in order, without editing or removing them', async ({ page }) => {
    await openOutline(page, 'INT. ONE - DAY\n\nCUT TO:\n\n# A\n\nINT. TWO - DAY\n\n> FADE OUT.');
    await expect(page.locator('flow-script .fl-outline-line')).toHaveCount(4);
    await expect(page.locator('flow-script .fl-outline-list > .fl-outline-block').first()).toContainText('INT. ONE - DAY');
    await expect(page.locator('flow-script .fl-outline-card .fl-outline-transition')).toContainText('FADE OUT.');
    await expect(page.locator('flow-script .fl-outline-block .fl-outline-field')).toHaveCount(0);
    await expect(page.locator('flow-script .fl-outline-block .fl-outline-remove')).toHaveCount(0);
    await expect(block(page, 'INT. ONE - DAY').getByRole('button', { name: 'Move scene' })).toBeVisible();
  });

  test('a scene and its transition are one card with one handle, and move together', async ({ page }) => {
    await openOutline(page, 'INT. ONE - DAY\n\nCUT TO:\n\nINT. TWO - DAY\n\nINT. THREE - DAY\n\n# A\n\nINT. FOUR - DAY');
    const cards = page.locator('flow-script .fl-outline-block');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0).locator('.fl-outline-line')).toHaveCount(2);
    await expect(cards.nth(0).getByRole('button')).toHaveCount(1);
    await expect(cards.nth(1).locator('.fl-outline-line')).toHaveCount(1);
    await expect(page.locator('flow-script .fl-outline-card .fl-outline-block')).toContainText('INT. FOUR - DAY');

    await cards.nth(0).getByRole('button', { name: 'Move scene' }).focus();
    await page.keyboard.press('ArrowDown');
    expect(await value(page)).toContain('INT. TWO - DAY\n\nINT. ONE - DAY\n\nCUT TO:\n\nINT. THREE - DAY');
    await expect(cards.nth(1)).toContainText('CUT TO:');
  });

  test('a transition ending in a colon without TO joins its scene card', async ({ page }) => {
    await openOutline(page, 'INT. ONE - DAY\n\nSMASH CUT:\n\nINT. TWO - DAY');
    const cards = page.locator('flow-script .fl-outline-block');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('.fl-outline-line')).toHaveCount(2);
    await expect(cards.nth(0).locator('.fl-outline-transition')).toContainText('SMASH CUT:');
  });

  test('a scene number shows at the right of its card, and can be edited there', async ({ page }) => {
    await openOutline(page, '> FADE IN:\n\nINT. ONE - DAY #4#\n\nINT. TWO - DAY');
    const numbers = page.getByRole('textbox', { name: 'Scene number' });
    await expect(numbers).toHaveCount(2);
    await expect(numbers.first()).toHaveValue('4');
    await expect(numbers.nth(1)).toHaveValue('');
    await expect(numbers.nth(1)).toHaveAttribute('placeholder', '12A');
    await expect(numbers.nth(1)).toHaveCSS('border-top-style', 'solid');
    const [content, box] = await numbers.first().evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(content).toBeLessThanOrEqual(box);
    await expect(block(page, 'INT. ONE')).not.toContainText('#');

    const row = await page.locator('flow-script .fl-outline-scene').first().boundingBox();
    const number = await numbers.first().boundingBox();
    expect(Math.abs((number.x + number.width) - (row.x + row.width))).toBeLessThan(2);

    await numbers.first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('A!');
    await expect(numbers.first()).toBeFocused();
    await expect(numbers.first()).toHaveValue('4A');
    await numbers.nth(1).click();
    await page.keyboard.type('5');
    expect(await value(page)).toBe('> FADE IN:\n\nINT. ONE - DAY #4A#\n\nINT. TWO - DAY #5#');
    await page.waitForTimeout(600); // quick edits to one spot undo together
    await numbers.nth(1).fill('');
    expect(await value(page)).toBe('> FADE IN:\n\nINT. ONE - DAY #4A#\n\nINT. TWO - DAY');
    await page.keyboard.press('Control+z');
    await expect(numbers.nth(1)).toHaveValue('5');
    await expect(page.locator('flow-script .fl-outline-transition textarea')).toHaveCount(0);
  });

  test('a card has one icon with its lines beside it, and its handle at the top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '> FADE IN:\n\nINT. ONE - DAY\n\nCUT TO:');
    const card = page.locator('flow-script .fl-outline-block').first();
    await expect(card.locator('.fl-outline-kind')).toHaveCount(1);
    await expect(page.locator('flow-script .fl-outline-block')).toHaveCount(2);
    const top = (await card.boundingBox()).y;
    const grip = await card.getByRole('button', { name: 'Move scene' }).boundingBox();
    expect(grip.y - top).toBeLessThan(10);
    const icon = await card.locator('.fl-outline-kind').boundingBox();
    const [transition, scene] = await card.locator('.fl-outline-line').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().x));
    expect(transition).toBe(scene);
    expect(transition).toBeGreaterThan(icon.x + icon.width - 1);
  });

  test('the tools read Act, Sequence and Synopsis, each in its own pill, and cards hold no add buttons', async ({ page }) => {
    await openOutline(page, '# A\n\n## S');
    const pills = page.locator('flow-script .fl-action-pills > .fl-pill');
    await expect(pills).toHaveCount(3);
    await expect(pills).toHaveText(['Act', 'Sequence', 'Synopsis']);
    await expect(page.locator('flow-script .fl-outline').getByRole('button', { name: /^Add/ })).toHaveCount(0);
  });

  test('a scene card can move above a synopsis, and a synopsis can move on its own', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# A\n= Plan\n\nINT. X - DAY\n\nText.\n\nINT. Y - DAY');
    const synopsisRow = page.locator('flow-script .fl-outline-synopsis');
    const first = await dragHandle(page, block(page, 'INT. X').getByRole('button', { name: 'Move scene' }), synopsisRow);
    await first.drop();
    expect(await value(page)).toBe('# A\n\nINT. X - DAY\n\nText.\n= Plan\n\nINT. Y - DAY');
    await expect(page.locator('flow-script .fl-outline-children > *').nth(1)).toHaveClass(/fl-outline-synopsis/);
    await expect(block(page, 'INT. X')).toContainText('INT. X - DAY');

    const handle = synopsisRow.getByRole('button', { name: 'Move synopsis', exact: true });
    const second = await dragHandle(page, handle, block(page, 'INT. Y'), 'bottom');
    await second.drop();
    expect(await value(page)).toBe('# A\n\nINT. X - DAY\n\nText.\n\nINT. Y - DAY\n= Plan');
    await expect(fields(page).first()).toHaveValue('A');
    await expect(fields(page).nth(1)).toHaveValue('Plan');

    await handle.focus();
    await page.keyboard.press('ArrowUp');
    expect(await value(page)).toBe('# A\n\nINT. X - DAY\n\nText.\n= Plan\n\nINT. Y - DAY');
    await expect(handle).toBeFocused();
  });

  test('a line joins each act card to the next', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# A\n\n## S\n\n# B\n\n# C');
    const line = (nth) => page.locator('flow-script .fl-outline-list > .fl-outline-card').nth(nth).evaluate((el) => {
      const style = getComputedStyle(el, '::before');
      return { content: style.content, height: parseFloat(style.height) };
    });
    expect((await line(0)).content).toBe('none');
    for (const nth of [1, 2]) {
      expect((await line(nth)).content).not.toBe('none');
      expect((await line(nth)).height).toBeGreaterThan(10);
    }
    await expect(page.locator('flow-script .fl-outline-card .fl-outline-card')).toHaveCSS('position', 'static');
  });

  test('cards use icons rather than # and =', async ({ page }) => {
    await openOutline(page, '# A\n= s\n\n## B');
    await expect(page.locator('flow-script .fl-outline-card').first().locator('.fl-outline-kind .fl-svg').first()).toBeVisible();
    const text = await page.locator('flow-script .fl-outline-list').evaluate((el) => el.textContent);
    expect(text).not.toMatch(/[#=]/);
  });

  test('the remove button shows only for the card pointed at or being edited', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# A\n= s\n\n## B\n\n# C');
    await page.mouse.move(2, 400);
    const removes = page.locator('flow-script .fl-outline-remove');
    const opacities = () => removes.evaluateAll((all) => all.map((el) => getComputedStyle(el).opacity));
    expect(await opacities()).toEqual(['0', '0', '0', '0']);

    const outer = page.locator('flow-script .fl-outline-card').first();
    await outer.locator('.fl-outline-field').first().hover();
    // A's header and synopsis, then B and C.
    expect(await opacities()).toEqual(['1', '1', '0', '0']);

    await page.locator('flow-script .fl-outline-card .fl-outline-card .fl-outline-field').hover();
    expect(await opacities()).toEqual(['0', '0', '1', '0']);

    await fields(page).last().click();
    await page.mouse.move(2, 400);
    expect(await opacities()).toEqual(['0', '0', '0', '1']);
    await expect(removes.first()).toHaveCSS('pointer-events', 'none');
  });

  test('dragging a scene moves it with its dialogue', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# A\n\nINT. ONE - DAY\n\nBOB\nHi.\n\nINT. TWO - DAY\n\nTwo.');
    const { drop } = await dragHandle(page, block(page, 'INT. ONE').getByRole('button', { name: 'Move scene' }), block(page, 'INT. TWO'), 'bottom');
    await expect(page.locator('flow-script .fl-outline-drop')).toBeVisible();
    await expect(page.locator('flow-script .fl-outline-ghost')).toContainText('INT. ONE - DAY');
    await drop();
    expect(await value(page)).toBe('# A\n\nINT. TWO - DAY\n\nTwo.\n\nINT. ONE - DAY\n\nBOB\nHi.');
    await expect(page.locator('flow-script .fl-outline-drop')).toBeHidden();
    await expect(page.locator('flow-script .fl-outline-ghost')).toBeHidden();
    await historyButton(page, 'Undo').click();
    expect(await value(page)).toBe('# A\n\nINT. ONE - DAY\n\nBOB\nHi.\n\nINT. TWO - DAY\n\nTwo.');
  });

  test('dragging a card carries what it holds, and Escape cancels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const script = '# A\n= a\n\nINT. X - DAY\n\n# B\n= b';
    await openOutline(page, script);
    const handle = page.getByRole('button', { name: 'Move act', exact: true }).nth(1);
    const firstCard = page.locator('flow-script .fl-outline-list > .fl-outline-card').first();

    const first = await dragHandle(page, handle, firstCard);
    await page.keyboard.press('Escape');
    await first.drop();
    expect(await value(page)).toBe(script);

    const second = await dragHandle(page, handle, firstCard);
    await second.drop();
    expect(await value(page)).toBe('# B\n= b\n\n# A\n= a\n\nINT. X - DAY');
    await expect(fields(page).first()).toHaveValue('B');
    await expect(fields(page).nth(1)).toHaveValue('b');
  });

  test('a scene cannot land after a sequence without joining it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutline(page, '# A\n\nINT. X - DAY\n\n## S\n\n# B');
    const inner = page.locator('flow-script .fl-outline-card .fl-outline-card');
    const { drop } = await dragHandle(page, block(page, 'INT. X').getByRole('button', { name: 'Move scene' }), inner, 'bottom');
    await drop();
    await expect(inner.locator('.fl-outline-block')).toContainText('INT. X - DAY');
    expect(await value(page)).toBe('# A\n\n## S\n\nINT. X - DAY\n\n# B');
  });

  test('the arrow keys move a card and keep hold of it', async ({ page }) => {
    const start = 'INT. ONE - DAY\n\nCUT TO:\n\nINT. TWO - DAY\n\nINT. THREE - DAY';
    await openOutline(page, start);
    const handle = block(page, 'INT. ONE').getByRole('button', { name: 'Move scene' });
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    expect(await value(page)).toBe('INT. TWO - DAY\n\nINT. ONE - DAY\n\nCUT TO:\n\nINT. THREE - DAY');
    await expect(handle).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const atEnd = 'INT. TWO - DAY\n\nINT. THREE - DAY\n\nINT. ONE - DAY\n\nCUT TO:';
    expect(await value(page)).toBe(atEnd);
    await page.keyboard.press('ArrowDown');
    expect(await value(page)).toBe(atEnd);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    expect(await value(page)).toBe(start);
    await page.keyboard.press('Control+z');
    expect(await value(page)).toBe('INT. TWO - DAY\n\nINT. ONE - DAY\n\nCUT TO:\n\nINT. THREE - DAY');
  });

  test('dragging works by touch', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, baseURL: 'http://localhost:4178' });
    const page = await context.newPage();
    await openOutline(page, 'INT. ONE - DAY\n\nINT. TWO - DAY');
    const handle = block(page, 'INT. TWO').getByRole('button', { name: 'Move scene' });
    await expect(handle).toHaveCSS('touch-action', 'none');
    const box = await handle.boundingBox();
    const target = await block(page, 'INT. ONE').boundingBox();
    const cdp = await context.newCDPSession(page);
    const point = (y) => [{ x: box.x + box.width / 2, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(box.y + box.height / 2) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(box.y - 8) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(target.y - 4) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => value(page)).toBe('INT. TWO - DAY\n\nINT. ONE - DAY');
    await context.close();
  });

  test('cards fit a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openOutline(page, '# A long act that has to wrap on a small screen\n= With a synopsis\n\n## And a sequence');
    const overflow = await host(page).evaluate((el) => {
      const scroll = el.shadowRoot.querySelector('.fl-scroll');
      return scroll.scrollWidth - scroll.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('title page values on their own lines', () => {
  const setCursorAtEnd = async (page, text) => {
    const line = lineWith(page, text);
    await line.click();
    await expect(line).toHaveClass(/fl-active/);
    await page.keyboard.press('End');
    await page.waitForTimeout(100); // the editor hears about the cursor just after it moves
  };

  test('Enter indents after a bare key and keeps going, until pressed twice', async ({ page }) => {
    await open(page);
    await setValue(page, 'Title: T\nContact:\n\nAction.');
    await setCursorAtEnd(page, 'Contact');
    await page.keyboard.press('Enter');
    await page.keyboard.type('One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Two');
    expect(await value(page)).toBe('Title: T\nContact:\n    One\n    Two\n\nAction.');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('Title: T\nContact:\n    One\n    Two\n    \n\nAction.');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('Title: T\nContact:\n    One\n    Two\n\n\nAction.');
    await page.keyboard.type('Z');
    expect((await value(page)).split('\n')[4]).toBe('Z');
  });

  test('Enter on existing indented values continues them at their indent', async ({ page }) => {
    await open(page);
    await setValue(page, 'Contact:\n   One\n   Two\nNotes: N');
    await setCursorAtEnd(page, 'One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Mid');
    expect(await value(page)).toBe('Contact:\n   One\n   Mid\n   Two\nNotes: N');
  });

  test('a value beside its key gets an ordinary new line', async ({ page }) => {
    await open(page);
    await setValue(page, 'Title: Mine\nAuthor: Me');
    await setCursorAtEnd(page, 'Mine');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('Title: Mine\n\nAuthor: Me');
  });

  test('Enter partway through a value makes two values', async ({ page }) => {
    await open(page);
    await setValue(page, 'Contact:\n    OneTwo');
    await setCursorAtEnd(page, 'OneTwo');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('Contact:\n    One\n    Two');
  });

  test('the key shows from any of its values, and other fields stay as they were', async ({ page }) => {
    await open(page);
    await setValue(page, 'Title: T\nContact:\n  One\n  Two\nNotes:\n  Three\n\nAction.');
    const lineHolding = (text) => page.locator('flow-script .ProseMirror .fl-line').filter({ hasText: text });
    const keyMarker = lineHolding('Contact:').locator('.fl-marker').first();
    await expect(keyMarker).toBeHidden();
    await lineHolding('Two').click();
    for (const text of ['Contact:', 'One', 'Two']) await expect(lineHolding(text)).toHaveClass(/fl-active/);
    await expect(keyMarker).toBeVisible();
    await expect(lineHolding('Title:')).not.toHaveClass(/fl-active/);
    await expect(lineHolding('Notes:')).not.toHaveClass(/fl-active/);
    await lineHolding('Action.').click();
    await expect(keyMarker).toBeHidden();
  });

  test('values keep the formatting of their field while still empty and once typed', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1000 });
    await open(page);
    await setValue(page, 'Title: T\nContact:\n\nAction.');
    await setCursorAtEnd(page, 'Contact');
    await page.keyboard.press('Enter');
    const lines = page.locator('flow-script .ProseMirror .fl-line');
    await expect(lines.nth(2)).toHaveClass(/fl-title-contact/);
    await expect(lines.nth(2)).toHaveClass(/fl-active/);
    await expect(lines.nth(1)).toHaveClass(/fl-active/);
    await expect(lines.nth(3)).not.toHaveClass(/fl-title-contact/);
    await expect(lines.nth(4)).toHaveClass(/fl-action/);
    await page.keyboard.type('One');
    await expect(lines.nth(2)).toHaveClass(/fl-title-contact/);
    await page.keyboard.press('Enter');
    await expect(lines.nth(3)).toHaveClass(/fl-title-contact/);
    expect((await lines.nth(3).boundingBox()).x).toBeCloseTo((await lines.nth(2).boundingBox()).x, 0);
  });

  for (const view of ['page', 'flow']) {
    const pace = (page) => page.waitForTimeout(300);
    const press = async (page, ...keys) => {
      for (const key of keys) {
        await page.keyboard.press(key);
        await pace(page);
      }
    };
    const inView = async (page, script) => {
      await open(page);
      await host(page).evaluate((el, v) => el.setAttribute('view', v), view);
      await setValue(page, script);
    };

    test(`indents take up no room in ${view} view`, async ({ page }) => {
      await inView(page, 'Contact:\n        One\n\nAction.');
      const textLeft = (text) => page.locator('flow-script .ProseMirror .fl-line').filter({ hasText: text }).evaluate((el) => {
        const range = document.createRange();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node.textContent.trim() === '') node = walker.nextNode();
        range.setStart(node, node.textContent.search(/\S/));
        range.setEnd(node, node.textContent.length);
        return range.getBoundingClientRect().left;
      });
      await page.locator('flow-script .ProseMirror .fl-line').filter({ hasText: 'One' }).click();
      await pace(page);
      expect(Math.abs(await textLeft('One') - await textLeft('Contact:'))).toBeLessThan(2);
    });

    test(`Up and Down walk a key and its values in ${view} view`, async ({ page }) => {
      await inView(page, 'Contact:\n  One\n  Two\n  Three\n\nAction.');
      await setCursorAtEnd(page, 'Contact');
      await press(page, 'ArrowDown');
      await page.keyboard.type('a');
      await pace(page);
      await press(page, 'ArrowDown', 'ArrowDown');
      await page.keyboard.type('b');
      await pace(page);
      await press(page, 'ArrowUp', 'ArrowUp', 'ArrowUp');
      await page.keyboard.type('c');
      expect(await value(page)).toBe('Contact:c\n  aOne\n  Two\n  Tbhree\n\nAction.'); // each move keeps the column
    });

    test(`the cursor never lands inside an indent in ${view} view`, async ({ page }) => {
      await inView(page, 'Contact:\n    One\n\nAction.');
      await setCursorAtEnd(page, 'One');
      await press(page, 'Home');
      await page.keyboard.type('Z');
      expect(await value(page)).toBe('Contact:\n    ZOne\n\nAction.');
      await press(page, 'Home', 'ArrowLeft');
      await page.keyboard.type('Y');
      expect(await value(page)).toBe('Contact:Y\n    ZOne\n\nAction.');
    });

    test(`Backspace at the start of a value joins lines in ${view} view`, async ({ page }) => {
      await inView(page, 'Contact:\n    One\n    Two\n\nAction.');
      await setCursorAtEnd(page, 'Two');
      await press(page, 'Home', 'Backspace');
      expect(await value(page)).toBe('Contact:\n    OneTwo\n\nAction.');
      await page.keyboard.type('Z');
      expect(await value(page)).toBe('Contact:\n    OneZTwo\n\nAction.');
    });

    test(`Enter on a new empty value leaves a regular line in ${view} view`, async ({ page }) => {
      await inView(page, 'Title: T\nContact:\n\nAction.');
      await setCursorAtEnd(page, 'Contact');
      await press(page, 'Enter', 'Enter');
      expect(await value(page)).toBe('Title: T\nContact:\n\n\nAction.');
      await page.keyboard.type('Regular');
      const lines = page.locator('flow-script .ProseMirror .fl-line');
      await expect(lines.nth(2)).not.toHaveClass(/fl-title/);
    });
  }

  test('Fountain view shows the indent and leaves the keys alone', async ({ page }) => {
    await open(page);
    await host(page).evaluate((el) => el.setAttribute('view', 'source'));
    await setValue(page, 'Contact:\n    One\n    Two');
    await lineWith(page, 'Two').click();
    await page.waitForTimeout(100);
    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    await page.keyboard.type('Z');
    expect(await value(page)).toBe('Contact:\n    One\nZ    Two');
  });

  test('each Enter undoes on its own', async ({ page }) => {
    await open(page);
    await setValue(page, 'Contact:');
    await setCursorAtEnd(page, 'Contact');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('Contact:\n    ');
    await page.keyboard.press('Control+z');
    expect(await value(page)).toBe('Contact:');
  });

  test('the cursor sits under the value on the page, not somewhere else', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1000 });
    await open(page);
    await setValue(page, 'Title: T\nContact:\n    One\n\nAction.');
    await setCursorAtEnd(page, 'One');
    const above = await lineWith(page, 'One').boundingBox();
    await page.keyboard.press('Enter');
    const active = page.locator('flow-script .ProseMirror .fl-line.fl-active').last();
    await expect(active).toHaveClass(/fl-title-contact/);
    const box = await active.boundingBox();
    expect(Math.abs(box.x - above.x)).toBeLessThan(2);
    expect(Math.abs(box.y - above.y)).toBeLessThan(40);
  });
});

test.describe('project settings', () => {
  const pageWidth = (page) => host(page).evaluate((el) => el.style.getPropertyValue('--fl-page-w'));
  const openSettings = async (page) => {
    await page.locator('flow-script .fl-settings').getByRole('button', { name: 'Project settings' }).click();
    const dialog = page.locator('flow-script dialog');
    await expect(dialog.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
    return dialog;
  };

  test('the page shows each size as it is chosen, and only Save writes it', async ({ page }) => {
    await open(page);
    await setValue(page, 'Title: BIG\n\nAction.');
    expect(await pageWidth(page)).toBe('51em');
    let dialog = await openSettings(page);
    await expect(dialog.getByText('Settings are saved in the script title section')).toBeVisible();
    await dialog.getByLabel('Dimensions').selectOption('a4');
    await expect.poll(() => pageWidth(page)).toBe(`${8.27 * 6}em`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => pageWidth(page)).toBe('51em');
    expect(await value(page)).toBe('Title: BIG\n\nAction.');

    dialog = await openSettings(page);
    await dialog.getByLabel('Dimensions').selectOption('a4');
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect(await value(page)).toBe('Title: BIG\n/*\nSettings:\n    Dimensions: A4\n*/\n\nAction.');
    expect(await pageWidth(page)).toBe(`${8.27 * 6}em`);
  });

  test('a custom size can be in centimetres', async ({ page }) => {
    await open(page);
    await setValue(page, 'Action.');
    const dialog = await openSettings(page);
    await dialog.getByLabel('Dimensions').selectOption('custom');
    await dialog.getByLabel('Unit').selectOption('cm');
    await expect(dialog.getByLabel('Width')).toHaveValue('21.59');
    await dialog.getByLabel('Width').fill('21');
    await dialog.getByLabel('Height').fill('29.7');
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect(await value(page)).toBe('/*\nSettings:\n    Dimensions: 21cm x 29.7cm\n*/\n\nAction.');
  });

  for (const view of ['Paged', 'Seamless']) {
    test(`settings are out of sight in ${view} view, and the cursor goes around them`, async ({ page }) => {
      await open(page);
      await chooseView(page, view);
      await setValue(page, 'Title: BIG\n/*\nSettings:\n    Dimensions: A4\n*/\n\nAction.');
      await expect(lineWith(page, 'Dimensions')).toBeHidden();
      // Page gaps follow a pause in typing, and keys pressed before they settle can go astray.
      const pace = () => page.waitForTimeout(300);
      await lineWith(page, 'BIG').click();
      await pace();
      for (const key of ['End', 'Delete', 'Enter']) {
        await page.keyboard.press(key);
        await pace();
      }
      await page.keyboard.type('X');
      // Delete leaves the settings alone.
      expect(await value(page)).toBe('Title: BIG\nX\n/*\nSettings:\n    Dimensions: A4\n*/\n\nAction.');
    });
  }

  test('Fountain view shows the settings', async ({ page }) => {
    await open(page);
    await setValue(page, '/*\nSettings:\n    Dimensions: A4\n*/\n\nAction.');
    await chooseView(page, 'Fountain');
    await expect(lineWith(page, 'Dimensions')).toBeVisible();
  });

  test("the export defaults to the script's size, and another one leaves the page alone", async ({ page }) => {
    await open(page);
    await setValue(page, '/*\nSettings:\n    Dimensions: A4\n*/\n\nAction.');
    const dialog = await openExport(page);
    const paper = dialog.getByLabel('Paper');
    await expect(paper.locator('option:checked')).toHaveText('Default (A4)');
    await paper.selectOption('letter');
    await page.keyboard.press('Escape');
    expect(await pageWidth(page)).toBe(`${8.27 * 6}em`);
  });

  test('on a phone, settings join the ... menu', async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 400, height: 800 });
    await expect(page.locator('flow-script .fl-settings')).toBeHidden();
    const holder = page.locator('flow-script .fl-export-holder');
    await holder.getByRole('button', { name: 'Export', exact: true }).click();
    await holder.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await expect(page.locator('flow-script dialog').getByRole('heading', { name: 'Project Settings' })).toBeVisible();
  });
});

test('the project settings draw the page at its proportions, measured', async ({ page }) => {
  await open(page);
  await page.locator('flow-script .fl-settings').getByRole('button', { name: 'Project settings' }).click();
  const dialog = page.locator('flow-script dialog');
  const preview = dialog.getByRole('img', { name: /^Page / });
  await expect(preview).toHaveAttribute('aria-label', 'Page 8.5 by 11 in');
  const ratio = async () => {
    const box = await preview.locator('.fl-preview-sheet').boundingBox();
    return box.width / box.height;
  };
  await expect.poll(ratio).toBeCloseTo(8.5 / 11, 1);
  await dialog.getByLabel('Dimensions').selectOption('custom');
  await dialog.getByLabel('Width').fill('17');
  await dialog.getByLabel('Height').fill('6');
  await expect(preview).toHaveAttribute('aria-label', 'Page 17 by 6 in');
  await expect(preview.getByText('17 in')).toBeVisible();
  await expect.poll(ratio).toBeCloseTo(17 / 6, 1);
  const frame = await preview.boundingBox();
  const sheet = await preview.locator('.fl-preview-sheet').boundingBox();
  expect(sheet.x).toBeGreaterThanOrEqual(frame.x);
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(frame.x + frame.width);
});
