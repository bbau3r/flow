// The extension system: the Extensions page of App settings, extension settings after the rule,
// theme extensions, extensions added from files, with or without code, or registered by code,
// widgets, sources, and the built-in Vim lite and Proton Drive.

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
const widget = (page) => page.locator('flow-script .fl-widget:not(.fl-command-widget)');
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
    expect(order).toEqual(['Appearance', 'Defaults', 'Sources', 'Extensions', 'App', 'rule', 'Vim lite']);
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

  test('a theme is checked, added on, and can be removed', async ({ page }) => {
    await add(page, THEME, 'mint.json');
    await expect(details(page, 'mint')).toBeVisible();
    await expect(toggleFor(page, 'mint')).toBeChecked();
    await expect(details(page, 'mint')).toContainText('Added from a file');
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
    await expect(error(page)).toContainText('nothing Flow can run');
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
  // A source, a tab and a widget on the left, as an extension written in code would add them.
  const register = () => window.flowExtensions.register({ id: 'probe', kind: 'app', name: 'Probe' }, (flow) => {
    flow.addSource({
      id: 'probe-source', kind: 'cloud', label: 'Probe drive', description: 'A place for tests',
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
      node.className = 'probe-widget';
      node.textContent = 'probe';
      return script.addWidget({ node, place: 'bottom-start', label: 'Probe' });
    });
  });

  test('add a source to Open, a tab beside Read, and a widget on the left', async ({ page }) => {
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

    // The widget comes after the element's own pills on the left, before the space between.
    const order = await page.locator('flow-script .fl-statusbar').evaluate((bar) => [...bar.querySelectorAll('.fl-pill:not([hidden]), .fl-spacer')]
      .filter((n) => !n.parentElement.closest('.fl-pill')).map((n) => n.className));
    const probe = order.findIndex((c) => c.includes('fl-widget'));
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
    await expect(widget(page)).toHaveCount(0);
  });

  test('starts in Normal, with its widget just before undo and redo', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two three');
    await expect(vimMode(page)).toHaveText('NORMAL');
    const next = await widget(page).evaluate((node) => node.parentElement.nextElementSibling.getAttribute('aria-label'));
    expect(next).toBe('History');
    // Letters are commands, not text.
    await page.keyboard.type('w');
    await expect.poll(() => value(page)).toBe('one two three');
    await expect(widget(page)).toContainText('Next word');
    await page.keyboard.type('i');
    await expect(vimMode(page)).toHaveText('INSERT');
    await page.keyboard.type('big ');
    await page.keyboard.press('Escape');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect.poll(() => value(page)).toBe('one big two three');
    // The block cursor follows Normal mode.
    await expect(page.locator('flow-script .fl-caret-char')).toHaveCount(1);
    // Read has no cursor, so the widget stays in Write.
    await page.getByRole('tab', { name: 'Read' }).click();
    await expect(widget(page)).toBeHidden();
  });

  test('deletes, copies, pastes, undoes and redoes', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'alpha\nbeta\ngamma');
    await page.keyboard.type('dd');
    await expect.poll(() => value(page)).toBe('beta\ngamma');
    await expect(widget(page)).toContainText('dd');
    await expect(widget(page)).toContainText('Delete line');
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
    await expect(widget(page)).toContainText('Delete to next word');
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
    await expect(widget(page)).toContainText('Delete…');
    await page.keyboard.press('Escape');
    await expect(widget(page)).toContainText('Cancelled');
    await expect.poll(() => value(page)).toBe('one two');
  });

  test('a count before an insert repeats what was typed on leaving it', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'end');
    await page.keyboard.type('3ihey ');
    await expect(widget(page)).toContainText('Insert before, 3 times');
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

  test('follows its settings: start mode, an escape chord, the widget', async ({ page }) => {
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

    // Turned off, the widget goes; the keys still work.
    await docPill(page).click();
    await docMenu(page).locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Vim lite' }).click();
    await settings(page).getByRole('switch', { name: 'Mode widget' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(widget(page)).toHaveCount(0);
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

  test('searches with / and ?, finds again with n and N, and the word under the cursor with *', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one two\nthree two\nfour');
    const keys = page.locator('flow-script .vim-keys');
    // While it's typed, the mode reads Search and counts what it would find.
    await page.keyboard.type('/');
    await expect(vimMode(page)).toHaveText('SEARCH');
    await page.keyboard.type('two');
    await expect(keys).toHaveText('/two');
    await expect(widget(page)).toContainText('2 matches');
    await page.keyboard.press('Enter');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect(widget(page)).toContainText('Match 1 of 2');
    // The cursor is on it: x takes its first letter.
    await page.keyboard.type('x');
    await expect.poll(() => value(page)).toBe('one wo\nthree two\nfour');
    await page.keyboard.type('u');
    await page.keyboard.type('n');
    await expect(widget(page)).toContainText('Match 2 of 2');
    await page.keyboard.type('n');
    await expect(widget(page)).toContainText('Match 1 of 2, from the top');
    await page.keyboard.type('N');
    await expect(widget(page)).toContainText('Match 2 of 2, from the bottom');
    // ? searches back; a capital makes it match case.
    await page.keyboard.type('?One');
    await page.keyboard.press('Enter');
    await expect(widget(page)).toContainText('No match for “One”');
    await page.keyboard.type('?one');
    await page.keyboard.press('Enter');
    await expect(widget(page)).toContainText('Match 1 of 1');
    // * looks for the word under the cursor, whole.
    await page.keyboard.type('*');
    await expect(widget(page)).toContainText('Match 1 of 1, from the top');
    // Escape leaves a search being typed.
    await page.keyboard.type('/thr');
    await page.keyboard.press('Escape');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect(widget(page)).toContainText('Cancelled');
    await expect.poll(() => value(page)).toBe('one two\nthree two\nfour');
  });

  test('turned off again, it leaves nothing behind', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one');
    await expect(widget(page)).toHaveCount(1);
    await openExtensions(page);
    await toggleFor(page, 'vim-lite').uncheck();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'one');
    await expect(widget(page)).toHaveCount(0);
    await expect(page.locator('flow-script .fl-caret-char')).toHaveCount(0);
    await page.keyboard.type('x');
    await expect.poll(() => value(page)).toBe('xone');
  });
});

test.describe('apps with code from files', () => {
  const MANIFEST = JSON.stringify({
    id: 'stamp', kind: 'app', name: 'Stamp', author: 'Test', main: 'stamp.js',
    icon: { paths: ['M4 4h16v16H4z'] },
  });
  // It counts its stamps in its own storage, and offers itself as a button in the top right.
  const CODE = `export function activate(flow) {
    flow.addCommand({
      id: 'stamp', label: 'Stamp', icon: 'plus', widget: 'top-end',
      run: async ({ script }) => {
        const count = ((await flow.storage.get('count')) ?? 0) + 1;
        await flow.storage.set('count', count);
        script.insertText('STAMP ' + count + ' ');
      },
    });
  }`;
  const trust = (page) => page.locator('dialog.fl-dialog');

  async function choose(page, files) {
    await openExtensions(page);
    const chooser = page.waitForEvent('filechooser');
    await settings(page).locator('#add-extension').click();
    await (await chooser).setFiles(files.map(([name, text]) => ({
      name, mimeType: name.endsWith('.json') ? 'application/json' : 'text/javascript', buffer: Buffer.from(text),
    })));
  }

  test('ask whether the code is trusted, every time, before adding it', async ({ page }) => {
    await choose(page, [['manifest.json', MANIFEST], ['stamp.js', CODE]]);
    await expect(trust(page).getByRole('heading', { name: 'Do you trust this extension?' })).toBeVisible();
    await expect(trust(page)).toContainText('stamp.js');
    await expect(trust(page)).toContainText('Stamp 1.0.0 by Test');
    // Not trusting is what a quick Enter does.
    await expect(trust(page).locator('#trust-cancel')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(trust(page)).toHaveCount(0);
    await expect(details(page, 'stamp')).toHaveCount(0);

    await choose(page, [['manifest.json', MANIFEST], ['stamp.js', CODE]]);
    await trust(page).locator('#trust-add').click();
    await expect(details(page, 'stamp')).toContainText('Runs its own code');
    // Its own icon, drawn from its path data.
    await expect(details(page, 'stamp').locator('.ext-meta path')).toHaveAttribute('d', 'M4 4h16v16H4z');
    // What someone adds starts on.
    await expect(toggleFor(page, 'stamp')).toBeChecked();

    // An update asks again.
    await choose(page, [['manifest.json', MANIFEST], ['stamp.js', CODE]]);
    await expect(trust(page)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('need their code file chosen with the manifest', async ({ page }) => {
    await choose(page, [['manifest.json', MANIFEST]]);
    await expect(settings(page).locator('.ext-add-error')).toContainText('This app’s code starts in stamp.js. Choose it together with the manifest.');
    await expect(trust(page)).toHaveCount(0);
  });

  test('run once added, from a widget in the top right, and keep their code and data', async ({ page }) => {
    await choose(page, [['manifest.json', MANIFEST], ['stamp.js', CODE]]);
    await trust(page).locator('#trust-add').click();
    await expect(toggleFor(page, 'stamp')).toBeChecked();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'end');
    const button = page.locator('flow-script .fl-topbar-end .fl-command-widget').getByRole('button', { name: 'Stamp' });
    await button.click();
    await expect.poll(() => value(page)).toBe('STAMP 1 end');
    // Its code comes back from this device's storage after a reload, and its count with it.
    await page.reload();
    await expect(button).toBeVisible();
    await page.locator('flow-script').evaluate((el) => { el.value = 'end'; el.selectText(0, 0, 0); });
    await button.click();
    await expect.poll(() => value(page)).toBe('STAMP 2 end');
    await docPill(page).click();
    await expect(docMenu(page).locator('[data-command="stamp.stamp"]')).toBeVisible();
  });
});

test.describe('apps with code in several files', () => {
  test('load each file the main one imports', async ({ page }) => {
    await openExtensions(page);
    const chooser = page.waitForEvent('filechooser');
    await settings(page).locator('#add-extension').click();
    const file = (name, text) => ({ name, mimeType: name.endsWith('.json') ? 'application/json' : 'text/javascript', buffer: Buffer.from(text) });
    await (await chooser).setFiles([
      file('manifest.json', JSON.stringify({ id: 'greeter', kind: 'app', name: 'Greeter', main: 'index.js' })),
      file('index.js', `import { greeting } from './words.js';
        export default function (flow) {
          flow.addCommand({ id: 'greet', label: 'Greet', run: ({ script }) => script.insertText(greeting()) });
        }`),
      file('words.js', `export const greeting = () => 'Hello there. ';`),
    ]);
    const dialog = page.locator('dialog.fl-dialog');
    await expect(dialog).toContainText('index.js, words.js');
    await dialog.locator('#trust-add').click();
    await expect(toggleFor(page, 'greeter')).toBeChecked();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'end');
    await docPill(page).click();
    await docMenu(page).locator('[data-command="greeter.greet"]').click();
    await expect.poll(() => value(page)).toBe('Hello there. end');
  });
});

test.describe('widgets', () => {
  test('a command from JSON can be a button in the top right corner', async ({ page }) => {
    await openExtensions(page);
    const chooser = page.waitForEvent('filechooser');
    await settings(page).locator('#add-extension').click();
    await (await chooser).setFiles({
      name: 'scene.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ id: 'scene-start', kind: 'app', name: 'Scene start', commands: [{ id: 'int', label: 'Insert INT.', icon: 'scene', widget: 'top-end', insert: 'INT. ' }] })),
    });
    await expect(toggleFor(page, 'scene-start')).toBeChecked();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'house');
    const corner = page.locator('flow-script .fl-topbar-end');
    await corner.getByRole('button', { name: 'Insert INT.' }).click();
    await expect.poll(() => value(page)).toBe('INT. house');
    // It's at the right of the top row.
    const box = await corner.locator('.fl-widget').boundingBox();
    expect(box.x + box.width).toBeGreaterThan((page.viewportSize().width) - 40);
  });
});

test.describe('sources', () => {
  test('App settings lists where scripts can live: Temp, Local and Cloud', async ({ page }) => {
    await page.goto(HOME);
    await page.locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Sources' }).click();
    const topics = await settings(page).locator('.fl-settings-section:not([hidden]) .fl-settings-topic-head').allTextContents();
    expect(topics).toEqual(['Temp', 'Local', 'Cloud']);
    await expect(settings(page).getByText('This device', { exact: true })).toBeVisible();
    await expect(settings(page).getByText('No cloud sources')).toBeVisible();
  });
});

test.describe('App settings on a small screen', () => {
  test('the theme modes fold into a dropdown when their labels don’t fit, and come back when they do', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(HOME);
    await page.locator('#app-settings').click();
    const modes = settings(page).locator('.fl-theme-modes');
    await expect(modes).not.toHaveClass(/fl-fit-compact/);
    await expect(settings(page).getByRole('tab', { name: 'Light' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 700 });
    await expect(modes).toHaveClass(/fl-fit-compact/);
    await expect(settings(page).getByRole('button', { name: /^Mode: / })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(modes).not.toHaveClass(/fl-fit-compact/);
  });

  test('the guides wrap under their name', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await openExtensions(page);
    const box = await settings(page).boundingBox();
    for (const guide of ['themes.md', 'apps.md', 'sources.md']) {
      const link = settings(page).locator(`a[data-guide="${guide}"]`);
      await link.scrollIntoViewIfNeeded();
      const each = await link.boundingBox();
      expect(each.x).toBeGreaterThanOrEqual(box.x);
      expect(each.x + each.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
});
