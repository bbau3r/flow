// The extension system: the Extensions page of App settings, extension settings after the rule,
// theme extensions, extensions added from JSON or registered by code, and the built-in Vim lite.

import { test, expect } from '@playwright/test';

const HOME = '/flow/';
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => page.locator('flow-script').evaluate((el) => el.value);
const settings = (page) => page.locator('dialog.fl-settings-dialog');
const rail = (page) => settings(page).locator('.fl-settings-rail');
const toggleFor = (page, id) => settings(page).locator(`.fl-switch[data-extension="${id}"]`).first();
const details = (page, id) => settings(page).locator(`.ext-details[data-extension="${id}"]`);
const docPill = (page) => page.locator('flow-script .fl-docmenu-trigger');
const docMenu = (page) => page.locator('flow-script .fl-docmenu');
const bubble = (page) => page.locator('flow-script .fl-ext-bubble');
const vimMode = (page) => page.locator('flow-script .vim-mode');

// Opens App settings at its Extensions page, from home.
async function openExtensions(page) {
  await page.goto(HOME);
  await page.locator('#app-settings').click();
  await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
  await expect(settings(page).getByRole('heading', { name: 'Extensions', exact: true })).toBeVisible();
}

// Turns an extension on from App settings, then closes them.
async function turnOn(page, id) {
  await openExtensions(page);
  await toggleFor(page, id).check();
  await expect(toggleFor(page, id)).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(settings(page)).toHaveCount(0);
}

async function newScript(page) {
  await page.goto(HOME);
  await page.locator('#new-script').click();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('flow-script .fl-active').first()).toBeAttached();
}

// A script of plain action lines, with the cursor at the start of `line`.
async function scriptWith(page, text, line = 0) {
  await newScript(page);
  await page.locator('flow-script').evaluate((el, t) => { el.value = t; }, text);
  await page.locator('flow-script').evaluate((el, l) => el.selectText(l, 0, 0), line);
  await expect(page.locator('flow-script .fl-active').first()).toBeAttached();
}

test.describe('the Extensions page of App settings', () => {
  test('lists the built-in extensions, all off, apps then themes', async ({ page }) => {
    await openExtensions(page);
    const topics = await settings(page).locator('.fl-settings-section:not([hidden]) .fl-settings-topic-head').allTextContents();
    expect(topics).toEqual(['Apps', 'Themes', 'Add Custom']);
    for (const id of ['vim-lite', 'typewriter']) await expect(toggleFor(page, id)).not.toBeChecked();
    await expect(details(page, 'vim-lite')).toContainText('Built in');
    // Settings wait until it's on, and built-in ones can't be removed.
    await expect(details(page, 'vim-lite').locator('[data-action="settings"]')).toBeDisabled();
    await expect(settings(page).locator('[data-action="remove"]')).toHaveCount(0);
    // The search finds them by what they do.
    await settings(page).getByRole('searchbox').fill('palette');
    await expect(details(page, 'typewriter')).toBeVisible();
    await expect(details(page, 'vim-lite')).toBeHidden();
  });

  test('turning one on lasts through a reload, and its Settings button turns to its page', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await page.reload();
    await openExtensions(page);
    await expect(toggleFor(page, 'vim-lite')).toBeChecked();
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await expect(settings(page).getByRole('heading', { name: 'Vim lite', exact: true })).toBeVisible();
    await expect(settings(page).getByText('Leave Insert with')).toBeVisible();
  });

  test('fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await openExtensions(page);
    const box = await settings(page).boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    const add = settings(page).locator('#add-extension');
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport();
  });
});

test.describe('extension settings in App settings', () => {
  test('come after a rule, and Appearance can take their tab away', async ({ page }) => {
    await page.goto(HOME);
    await page.locator('#app-settings').click();
    // With nothing on, there's no rule and no extension tab.
    await expect(rail(page).locator('.fl-settings-rule')).toBeHidden();
    await expect(rail(page).getByRole('button', { name: 'Vim lite' })).toBeHidden();

    await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
    await toggleFor(page, 'vim-lite').check();
    const vimTab = rail(page).getByRole('button', { name: 'Vim lite' });
    await expect(vimTab).toBeVisible();
    await expect(rail(page).locator('.fl-settings-rule')).toBeVisible();
    // The rule comes after Flow's own sections and before the extension's.
    const order = await rail(page).locator(':scope > :not([hidden])').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tip') ?? 'rule'));
    expect(order).toEqual(['Appearance', 'Defaults', 'Extensions', 'App', 'rule', 'Vim lite']);
    await vimTab.click();
    await expect(settings(page).getByRole('heading', { name: 'Vim lite', exact: true })).toBeVisible();

    // Searching finds an extension's settings too.
    await settings(page).getByRole('searchbox').fill('block cursor');
    await expect(settings(page).getByText('Block cursor', { exact: true })).toBeVisible();
    await settings(page).getByRole('searchbox').fill('');

    await rail(page).getByRole('button', { name: 'Appearance' }).click();
    await settings(page).getByRole('switch', { name: 'Show Vim lite in App settings' }).uncheck();
    await expect(vimTab).toBeHidden();
    await expect(rail(page).locator('.fl-settings-rule')).toBeHidden();
    await page.keyboard.press('Escape');

    // It stays out of the rail, and the Extensions page still turns to it.
    await page.locator('#app-settings').click();
    await expect(rail(page).getByRole('button', { name: 'Vim lite' })).toBeHidden();
    await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await expect(settings(page).getByRole('heading', { name: 'Vim lite', exact: true })).toBeVisible();
  });
});

test.describe('theme extensions', () => {
  test('add their palette to the chooser while on, and keep the choice through off and on', async ({ page }) => {
    await page.goto(HOME);
    await page.locator('#app-settings').click();
    await expect(page.locator('.fl-theme-swatch[data-palette="typewriter"]')).toHaveCount(0);
    await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
    await toggleFor(page, 'typewriter').check();
    // The panel comes back with the palette in it, still on the Extensions page.
    await expect(toggleFor(page, 'typewriter')).toBeChecked();
    await expect(toggleFor(page, 'typewriter')).toBeFocused();
    await rail(page).getByRole('button', { name: 'Appearance' }).click();
    await page.locator('.fl-theme-swatch[data-palette="typewriter"]').click();
    await page.getByRole('tab', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'typewriter-light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(228, 225, 218)');
    await page.keyboard.press('Escape');

    // It reaches the script's own colors too.
    await newScript(page);
    await expect(page.locator('flow-script')).toHaveAttribute('theme', 'typewriter-light');
    const paper = await page.locator('flow-script').evaluate((el) => getComputedStyle(el).getPropertyValue('--flow-paper').trim());
    expect(paper).toBe('#faf8f3');

    // Off, the app falls back to Sage; on again, Typewriter comes back.
    await openExtensions(page);
    await toggleFor(page, 'typewriter').uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage-auto');
    await toggleFor(page, 'typewriter').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'typewriter-light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'typewriter-light');
  });
});

test.describe('extensions added from JSON', () => {
  const THEME = JSON.stringify({
    id: 'mint', kind: 'theme', name: 'Mint', author: 'Test',
    palettes: { mint: { label: 'Mint', light: { paper: '#f2fbf6', accent: '#1d7a55' }, dark: { paper: '#1f2622', accent: '#6fd3a8' } } },
  });
  const APP = JSON.stringify({
    id: 'snippets', kind: 'app', name: 'Snippets',
    commands: [{ id: 'interior', label: 'Insert INT.', shortcut: 'Mod+Shift+1', insert: 'INT. ' }],
  });
  const fileInput = (page) => settings(page).locator('input[type="file"]');
  const error = (page) => settings(page).locator('.ext-add-error');

  // Add extension opens the system's file picker; choosing a file adds it.
  async function add(page, json, name = 'extension.json') {
    await openExtensions(page);
    const chooser = page.waitForEvent('filechooser');
    await settings(page).locator('#add-extension').click();
    await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(json) });
  }

  test('a theme is checked, added off, and can be removed', async ({ page }) => {
    await add(page, THEME, 'mint.json');
    await expect(details(page, 'mint')).toBeVisible();
    await expect(toggleFor(page, 'mint')).not.toBeChecked();
    await expect(details(page, 'mint')).toContainText('Added from a file');
    await toggleFor(page, 'mint').check();
    await expect(toggleFor(page, 'mint')).toBeChecked();
    await page.reload();
    await openExtensions(page);
    await expect(toggleFor(page, 'mint')).toBeChecked();
    page.once('dialog', (dialog) => dialog.accept());
    await details(page, 'mint').locator('[data-action="remove"]').click();
    await expect(details(page, 'mint')).toHaveCount(0);
    await page.reload();
    await openExtensions(page);
    await expect(details(page, 'mint')).toHaveCount(0);
  });

  test('anything that isn’t right is turned away with a reason, under the button', async ({ page }) => {
    const choose = async (json, name = 'bad.json') => fileInput(page).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(json) });
    await add(page, '{ not json', 'broken.json');
    await expect(error(page)).toHaveText('broken.json: That isn’t JSON Flow can read.');
    await choose(JSON.stringify({ id: 'x1', kind: 'widget', name: 'X' }));
    await expect(error(page)).toContainText('kind');
    // Colors go into a stylesheet, so only colors get in.
    await choose(JSON.stringify({ id: 'bad', kind: 'theme', name: 'Bad', palettes: { bad: { light: { paper: 'red; } body { display: none' } } } }));
    await expect(error(page)).toContainText('isn’t a color');
    // Built-in ids are taken, so Vim lite's own manifest can't be added again.
    await choose(JSON.stringify({ id: 'vim-lite', kind: 'theme', name: 'Fake', palettes: { fake: { light: { paper: '#fff' } } } }));
    await expect(error(page)).toContainText('already has');
    // A file brings no code, so an app with nothing to run is turned away.
    await choose(JSON.stringify({ id: 'empty-app', kind: 'app', name: 'Empty', settings: [{ key: 'on', label: 'On' }] }));
    await expect(error(page)).toContainText('doesn’t load code from files');
    await expect(details(page, 'empty-app')).toHaveCount(0);
  });

  test('the guides to writing one are linked beside Add extension', async ({ page }) => {
    await openExtensions(page);
    for (const guide of ['themes.md', 'apps.md']) {
      const link = settings(page).locator(`a[data-guide="${guide}"]`);
      await expect(link).toHaveAttribute('href', `https://github.com/bbau3r/flow/blob/main/docs/extensions/${guide}`);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('an app’s commands join the Document menu and run on their shortcut', async ({ page }) => {
    await add(page, APP, 'snippets.json');
    await toggleFor(page, 'snippets').check();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'one\n\ntwo', 2);
    await docPill(page).click();
    const item = docMenu(page).locator('[data-command="snippets.interior"]');
    await expect(item).toContainText('Insert INT.');
    await item.click();
    await expect.poll(() => value(page)).toBe('one\n\nINT. two');
    await page.keyboard.press('ControlOrMeta+Shift+Digit1');
    await expect.poll(() => value(page)).toBe('one\n\nINT. INT. two');
  });
});

test.describe('extensions registered by code', () => {
  // A source, a tab and a bubble on the left, as an extension written in code would add them.
  const register = () => window.flowExtensions.register({ id: 'probe', kind: 'app', name: 'Probe' }, (flow) => {
    flow.addSource({
      id: 'probe-source', label: 'Probe drive', description: 'A place for tests',
      status: () => ({ ok: true }), open: async () => ({ name: 'probe.fountain', text: 'INT. PROBE - DAY', ref: {} }),
      save: async () => null, saveAs: async () => null, saveHint: () => '', location: () => 'Probe drive',
    });
    flow.addTab({
      id: 'stats', label: 'Stats', icon: 'info',
      render: (root, context) => {
        const words = context.lines().join(' ').split(/\s+/).filter(Boolean).length;
        root.textContent = `${words} words`;
      },
    });
    flow.onEditor((script) => {
      const node = document.createElement('span');
      node.className = 'probe-bubble';
      node.textContent = 'probe';
      return script.addBubble({ node, side: 'start', label: 'Probe' });
    });
  });

  test('add a source to Open, a tab beside Read, and a bubble on the left', async ({ page }) => {
    await page.goto(HOME);
    await page.evaluate(register);
    await page.locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
    await expect(details(page, 'probe')).toContainText('Added by code');
    await toggleFor(page, 'probe').check();
    await page.keyboard.press('Escape');

    // Open now asks where, offering the new source.
    await page.locator('#open-script').click();
    await page.locator('[data-provider="probe-source"]').click();
    await expect.poll(() => value(page)).toBe('INT. PROBE - DAY');

    await page.getByRole('tab', { name: 'Stats' }).click();
    await expect(page.locator('flow-script .fl-workspace')).toHaveText('4 words');
    await expect(page).toHaveURL(/\?tab=probe-stats$/);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeHidden();

    // The bubble comes after the element's own pills on the left, before the space between.
    const order = await page.locator('flow-script .fl-statusbar').evaluate((bar) => [...bar.querySelectorAll('.fl-pill:not([hidden]), .fl-spacer')]
      .filter((n) => !n.parentElement.closest('.fl-pill')).map((n) => n.className));
    const probe = order.findIndex((c) => c.includes('fl-ext-bubble'));
    expect(probe).toBeGreaterThan(0);
    expect(order[probe + 1]).toContain('fl-spacer');

    await page.getByRole('tab', { name: 'Write' }).click();
    await expect(editor(page)).toBeVisible();
  });
});

test.describe('Vim lite', () => {
  test('is off until turned on, so typing types', async ({ page }) => {
    await scriptWith(page, 'one');
    await page.keyboard.type('dd');
    await expect.poll(() => value(page)).toBe('ddone');
    await expect(bubble(page)).toHaveCount(0);
  });

  test('starts in Normal, with its bubble just before undo and redo', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two three');
    await expect(vimMode(page)).toHaveText('NORMAL');
    const next = await bubble(page).evaluate((node) => node.parentElement.nextElementSibling.getAttribute('aria-label'));
    expect(next).toBe('History');
    // Letters are commands, not text.
    await page.keyboard.type('w');
    await expect.poll(() => value(page)).toBe('one two three');
    await expect(bubble(page)).toContainText('Next word');
    await page.keyboard.type('i');
    await expect(vimMode(page)).toHaveText('INSERT');
    await page.keyboard.type('big ');
    await page.keyboard.press('Escape');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect.poll(() => value(page)).toBe('one big two three');
    // The block cursor follows Normal mode.
    await expect(page.locator('flow-script .fl-caret-char')).toHaveCount(1);
    // Read has no cursor, so the bubble stays in Write.
    await page.getByRole('tab', { name: 'Read' }).click();
    await expect(bubble(page)).toBeHidden();
  });

  test('deletes, copies, pastes, undoes and redoes', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'alpha\nbeta\ngamma');
    await page.keyboard.type('dd');
    await expect.poll(() => value(page)).toBe('beta\ngamma');
    await expect(bubble(page)).toContainText('dd');
    await expect(bubble(page)).toContainText('Delete line');
    await page.keyboard.type('p');
    await expect.poll(() => value(page)).toBe('beta\nalpha\ngamma');
    await page.keyboard.type('u');
    await expect.poll(() => value(page)).toBe('beta\ngamma');
    await page.keyboard.press('Control+r');
    await expect.poll(() => value(page)).toBe('beta\nalpha\ngamma');
    await page.keyboard.type('ggyyGp');
    await expect.poll(() => value(page)).toBe('beta\nalpha\ngamma\nbeta');
    await page.keyboard.type('gg2x');
    await expect.poll(() => value(page)).toBe('ta\nalpha\ngamma\nbeta');
  });

  test('runs operators over motions and counts', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two three four');
    await page.keyboard.type('dw');
    await expect.poll(() => value(page)).toBe('two three four');
    await expect(bubble(page)).toContainText('Delete to next word');
    await page.keyboard.type('2dw');
    await expect.poll(() => value(page)).toBe('four');
    await page.keyboard.type('cwfive');
    await page.keyboard.press('Escape');
    await expect.poll(() => value(page)).toBe('five');
    await page.keyboard.type('A and six');
    await page.keyboard.press('Escape');
    await page.keyboard.type('0d$');
    await expect.poll(() => value(page)).toBe('');
  });

  test('shows the keys of a command while it waits for the rest', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two');
    await page.keyboard.type('d');
    await expect(page.locator('flow-script .vim-keys')).toHaveText('d');
    await expect(page.locator('flow-script .vim-keys')).toHaveAttribute('data-pending', '');
    await expect(bubble(page)).toContainText('Delete…');
    await page.keyboard.press('Escape');
    await expect(bubble(page)).toContainText('Cancelled');
    await expect.poll(() => value(page)).toBe('one two');
  });

  test('a count before an insert repeats what was typed on leaving it', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'end');
    await page.keyboard.type('3ihey ');
    await expect(bubble(page)).toContainText('Insert before, 3 times');
    await page.keyboard.press('Escape');
    await expect.poll(() => value(page)).toBe('hey hey hey end');
    await page.keyboard.type('2ofoo');
    await page.keyboard.press('Escape');
    await expect.poll(() => value(page)).toBe('hey hey hey end\nfoo\nfoo');
    // One undo takes the repeats away, a second the typing.
    await page.keyboard.type('u');
    await expect.poll(() => value(page)).toBe('hey hey hey end\nfoo');
  });

  test('selects in Visual mode', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two three\nsecond');
    await page.keyboard.type('ve');
    await expect(vimMode(page)).toHaveText('VISUAL');
    await page.keyboard.type('d');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect.poll(() => value(page)).toBe(' two three\nsecond');
    await page.keyboard.type('Vjd');
    await expect.poll(() => value(page)).toBe('');
  });

  test('opens lines, joins them and replaces characters', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'first\nsecond');
    await page.keyboard.type('onew');
    await page.keyboard.press('Escape');
    await expect.poll(() => value(page)).toBe('first\nnew\nsecond');
    await page.keyboard.type('kJ');
    await expect.poll(() => value(page)).toBe('first new\nsecond');
    await page.keyboard.type('0rF');
    await expect.poll(() => value(page)).toBe('First new\nsecond');
  });

  test('follows its settings: start mode, an escape chord, the bubble', async ({ page }) => {
    await openExtensions(page);
    await toggleFor(page, 'vim-lite').check();
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await settings(page).getByRole('combobox', { name: 'Start in' }).selectOption('insert');
    await settings(page).getByRole('textbox', { name: 'Leave Insert with' }).fill('jk');
    await page.keyboard.press('Escape');

    await scriptWith(page, 'one');
    await expect(vimMode(page)).toHaveText('INSERT');
    await page.keyboard.type('ab');
    await page.keyboard.type('jk');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect.poll(() => value(page)).toBe('abone');

    // Turned off, the bubble goes; the keys still work.
    await docPill(page).click();
    await docMenu(page).locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Vim lite' }).click();
    await settings(page).getByRole('switch', { name: 'Mode bubble' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(bubble(page)).toHaveCount(0);
    await page.keyboard.type('x');
    await expect.poll(() => value(page)).toBe('aone');
  });

  test('tapping the mode switches between Normal and Insert, for screens with no Escape', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one');
    await vimMode(page).click();
    await expect(vimMode(page)).toHaveText('INSERT');
    await page.keyboard.type('a');
    await expect.poll(() => value(page)).toBe('aone');
    await vimMode(page).click();
    await expect(vimMode(page)).toHaveText('NORMAL');
  });

  test('turned off again, it leaves nothing behind', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one');
    await expect(bubble(page)).toHaveCount(1);
    await openExtensions(page);
    await toggleFor(page, 'vim-lite').uncheck();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'one');
    await expect(bubble(page)).toHaveCount(0);
    await expect(page.locator('flow-script .fl-caret-char')).toHaveCount(0);
    await page.keyboard.type('x');
    await expect.poll(() => value(page)).toBe('xone');
  });
});
