// The extension system: the Extensions page of App settings, extension settings after the rule,
// theme extensions, extensions added from files, with or without code, or registered by code,
// widgets, cloud providers, and the built-in Vim lite.

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

// The system's folder picker can't run headless, so this one hands back a folder from the
// browser's private file system, named by window.nextFolder. Everything after it is the real API.
const folderPicker = () => {
  window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(window.nextFolder);
};
test.beforeEach(({ page }) => page.addInitScript(folderPicker));

// Writes an extension's files into a folder there, for the folder picker to hand back.
async function writeFolder(page, name, files) {
  await page.evaluate(async ({ name: folderName, files: contents }) => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(folderName, { create: true });
    for (const [file, text] of Object.entries(contents)) {
      const writable = await (await folder.getFileHandle(file, { create: true })).createWritable();
      await writable.write(text);
      await writable.close();
    }
    window.nextFolder = folderName;
  }, { name, files });
}

// Add extension points to an extension's folder, holding manifest.json and its .js files.
async function addExtensionFolder(page, name, files) {
  await openExtensions(page);
  await writeFolder(page, name, files);
  await settings(page).locator('#add-extension').click();
}

// Add theme picks a theme's .json file.
async function addThemeFile(page, json, name = 'theme.json') {
  await openExtensions(page);
  const chooser = page.waitForEvent('filechooser');
  await settings(page).locator('#add-theme').click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(json) });
}

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
    const add = settings(page).locator('#add-theme');
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

test.describe('adding extensions and themes', () => {
  const THEME = JSON.stringify({
    id: 'mint', kind: 'theme', name: 'Mint', author: 'Test',
    palettes: { mint: { label: 'Mint', light: { paper: '#f2fbf6', accent: '#1d7a55' }, dark: { paper: '#1f2622', accent: '#6fd3a8' } } },
  });
  const SNIPPETS = JSON.stringify({
    id: 'snippets', kind: 'app', name: 'Snippets',
    commands: [{ id: 'interior', label: 'Insert INT.', shortcut: 'Mod+Shift+1', insert: 'INT. ' }],
  });
  const error = (page) => settings(page).locator('.ext-add-error');

  test('Add theme takes a theme’s file, whatever it’s called, adds it on, and it can be removed', async ({ page }) => {
    await addThemeFile(page, THEME, 'mint-theme.json');
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

  test('anything that isn’t right is turned away with a reason, under the buttons', async ({ page }) => {
    const theme = async (json, name = 'bad.json') => settings(page).locator('input[aria-label="Theme file"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(json) });
    await addThemeFile(page, '{ not json', 'broken.json');
    await expect(error(page)).toHaveText('broken.json: That isn’t JSON Flow can read.');
    await theme(JSON.stringify({ id: 'x1', kind: 'widget', name: 'X' }));
    await expect(error(page)).toContainText('kind');
    // Colors go into a stylesheet, so only colors get in.
    await theme(JSON.stringify({ id: 'bad', kind: 'theme', name: 'Bad', palettes: { bad: { light: { paper: 'red; } body { display: none' } } } }));
    await expect(error(page)).toContainText('isn’t a color');
    // Built-in ids are taken, so Vim lite's own manifest can't be added again.
    await theme(JSON.stringify({ id: 'vim-lite', kind: 'theme', name: 'Fake', palettes: { fake: { light: { paper: '#fff' } } } }));
    await expect(error(page)).toContainText('already has');
    // Each button takes its own kind.
    await theme(SNIPPETS, 'snippets.json');
    await expect(error(page)).toContainText('That’s an extension, not a theme. Use Add extension');
    await writeFolder(page, 'mint', { 'manifest.json': THEME });
    await settings(page).locator('#add-extension').click();
    await expect(error(page)).toContainText('That’s a theme. Use Add theme');
    // A folder needs its manifest.json.
    await writeFolder(page, 'empty', { 'notes.txt': 'nothing here' });
    await settings(page).locator('#add-extension').click();
    await expect(error(page)).toHaveText('empty: This folder has no manifest.json at its top level.');
    // An app with nothing to run is turned away.
    await writeFolder(page, 'idle', { 'manifest.json': JSON.stringify({ id: 'idle-app', kind: 'app', name: 'Idle', settings: [{ key: 'on', label: 'On' }] }) });
    await settings(page).locator('#add-extension').click();
    await expect(error(page)).toContainText('nothing Flow can run');
    await expect(details(page, 'idle-app')).toHaveCount(0);
  });

  test('the guides to writing one are linked beside the buttons', async ({ page }) => {
    await openExtensions(page);
    for (const guide of ['themes.md', 'apps.md', 'sources.md']) {
      const link = settings(page).locator(`a[data-guide="${guide}"]`);
      await expect(link).toHaveAttribute('href', `https://github.com/bbau3r/flow/blob/main/docs/extensions/${guide}`);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('an extension of JSON alone adds commands to the Document menu, which run on their shortcut', async ({ page }) => {
    await addExtensionFolder(page, 'snippets', { 'manifest.json': SNIPPETS });
    await expect(toggleFor(page, 'snippets')).toBeChecked();
    await expect(details(page, 'snippets')).toContainText('From the snippets folder');
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

    // The cloud source has a sheet of its own beside Open, with the extension's icon.
    const sheet = page.locator('.shelf [data-provider="probe-source"]');
    await expect(sheet).toContainText('Probe drive');
    await expect(sheet).toContainText('Cloud');
    await sheet.click();
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
    // The block cursor follows Normal mode, with no thin line beside it.
    await expect(page.locator('flow-script .fl-caret-char')).toHaveCount(1);
    await expect(editor(page)).toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
    await page.keyboard.type('i');
    await expect(editor(page)).not.toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
    await page.keyboard.press('Escape');
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

  test('follows its settings: start mode and an escape chord', async ({ page }) => {
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
    // The widget is always there, and the clipboard always shared: they're no settings.
    await expect(widget(page)).toHaveCount(1);
  });

  test('a key chosen in its settings works as Escape, and can be cleared', async ({ page }) => {
    await openExtensions(page);
    await toggleFor(page, 'vim-lite').check();
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    const field = settings(page).locator('.fl-key-capture');
    await expect(field).toHaveText('None');
    // Clicked, it takes the next key, even Escape, which would otherwise close the panel.
    await field.click();
    await expect(field).toHaveText('Press a key…');
    await page.keyboard.press('CapsLock');
    await expect(field).toHaveText('Caps Lock');
    await settings(page).getByRole('button', { name: 'Clear Also works as Escape' }).click();
    await expect(field).toHaveText('None');
    await field.click();
    await page.keyboard.press('Escape');
    await expect(settings(page)).toBeVisible();
    await expect(field).toHaveText('Esc');
    await field.click();
    await page.keyboard.press(';');
    await expect(field).toHaveText(';');
    await page.keyboard.press('Escape');

    await scriptWith(page, 'one');
    await page.keyboard.type('i');
    await expect(vimMode(page)).toHaveText('INSERT');
    await page.keyboard.type('a;');
    await expect(vimMode(page)).toHaveText('NORMAL');
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
    // Found, the mode reads Match, with which one it is.
    await expect(vimMode(page)).toHaveText('MATCH');
    await expect(widget(page)).toContainText('1 of 2');
    // The cursor is on it: x takes its first letter.
    await page.keyboard.type('x');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect.poll(() => value(page)).toBe('one wo\nthree two\nfour');
    await page.keyboard.type('u');
    await page.keyboard.type('n');
    await expect(vimMode(page)).toHaveText('MATCH');
    await expect(widget(page)).toContainText('2 of 2');
    await page.keyboard.type('n');
    await expect(widget(page)).toContainText('1 of 2, from the top');
    await page.keyboard.type('N');
    await expect(widget(page)).toContainText('2 of 2, from the bottom');
    // ? searches back; a capital makes it match case.
    await page.keyboard.type('?One');
    await page.keyboard.press('Enter');
    await expect(widget(page)).toContainText('No match for “One”');
    await page.keyboard.type('?one');
    await page.keyboard.press('Enter');
    await expect(widget(page)).toContainText('1 of 1');
    // * looks for the word under the cursor, whole.
    await page.keyboard.type('*');
    await expect(widget(page)).toContainText('1 of 1, from the top');
    // Escape leaves a search being typed.
    await page.keyboard.type('/thr');
    await page.keyboard.press('Escape');
    await expect(vimMode(page)).toHaveText('NORMAL');
    await expect(widget(page)).toContainText('Cancelled');
    await expect.poll(() => value(page)).toBe('one two\nthree two\nfour');
  });

  test('j and k follow wrapped lines, or whole lines with the setting off', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    await scriptWith(page, `${long}\nnext`);
    // A row down is still the long line, so x takes a letter from it.
    await page.keyboard.type('jx');
    await expect.poll(() => value(page)).not.toBe(`${long}\nnext`);
    expect((await value(page)).split('\n')[1]).toBe('next');
    expect((await value(page)).split('\n')[0]).not.toBe(long);

    await openExtensions(page);
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await settings(page).getByRole('switch', { name: 'Follow wrapped lines' }).uncheck();
    await page.keyboard.press('Escape');
    await scriptWith(page, `${long}\nnext`);
    await page.keyboard.type('jx');
    await expect.poll(() => value(page)).toBe(`${long}\next`);
  });

  test('moving into a narrower column, such as dialogue, lands at the row’s start or end', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const script = `${long}\n\nBOB\nHello there.`;
    // From the blank line, up onto the start of the action's last row, then two rows down to the
    // character cue, which starts further in: its start.
    await scriptWith(page, script, 1);
    await page.keyboard.type('kjjx');
    await expect.poll(() => value(page)).toBe(`${long}\n\nOB\nHello there.`);
    // From the end of a line of dialogue, further right than the cue above it ends: the cue's end.
    const dialogue = `${long}\n\nBOB\nHello there, how are you today?`;
    await scriptWith(page, dialogue, 3);
    await page.keyboard.type('$kx');
    await expect.poll(() => value(page)).toBe(`${long}\n\nBO\nHello there, how are you today?`);
  });

  test('the block cursor blinks at the speed chosen, or not at all', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one');
    const caret = page.locator('flow-script .fl-caret-char');
    await expect(caret).toHaveClass(/fl-caret-blink/);
    await expect(caret).toHaveAttribute('style', /--fl-caret-period: 1000ms/);
    await openExtensions(page);
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await settings(page).getByRole('combobox', { name: 'Blink speed' }).selectOption('fast');
    await page.keyboard.press('Escape');
    await scriptWith(page, 'one');
    await expect(caret).toHaveAttribute('style', /--fl-caret-period: 600ms/);
    await openExtensions(page);
    await details(page, 'vim-lite').locator('[data-action="settings"]').click();
    await settings(page).getByRole('switch', { name: 'Cursor blinks' }).uncheck();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'one');
    await expect(caret).not.toHaveClass(/fl-caret-blink/);
  });

  test('copies to the system clipboard, pastes what was copied elsewhere, and keeps named registers', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'alpha\nbeta');
    // Windows keeps line breaks on the clipboard as \r\n.
    const clipboard = () => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n?/g, '\n'));
    // A copied line goes to the clipboard as a line.
    await page.keyboard.type('yy');
    await expect.poll(clipboard).toBe('alpha\n');
    await page.keyboard.type('p');
    await expect.poll(() => value(page)).toBe('alpha\nalpha\nbeta');
    // Something newer copied elsewhere is what p pastes.
    await page.evaluate(() => navigator.clipboard.writeText('ELSE'));
    await page.keyboard.type('0P');
    await expect.poll(() => value(page)).toBe('alpha\nELSEalpha\nbeta');
    // A named register keeps its own, and "_ keeps nothing.
    await page.keyboard.type('G"ayy');
    await page.keyboard.type('gg"_dd');
    await expect.poll(() => value(page)).toBe('ELSEalpha\nbeta');
    await expect.poll(clipboard).toBe('beta\n');
    await page.keyboard.type('"ap');
    await expect.poll(() => value(page)).toBe('ELSEalpha\nbeta\nbeta');
  });

  test('records a macro with q and plays it back with @, @@ and a count', async ({ page }) => {
    await turnOn(page, 'vim-lite');
    await scriptWith(page, 'one\ntwo\nthree\nfour');
    await page.keyboard.type('qa');
    await expect(page.locator('flow-script .vim-rec')).toHaveText('REC a');
    await page.keyboard.type('I- ');
    await page.keyboard.press('Escape');
    await page.keyboard.type('j');
    await page.keyboard.type('q');
    await expect(page.locator('flow-script .vim-rec')).toBeHidden();
    await expect(widget(page)).toContainText('Recorded @a');
    await expect.poll(() => value(page)).toBe('- one\ntwo\nthree\nfour');
    await page.keyboard.type('@a');
    await expect.poll(() => value(page)).toBe('- one\n- two\nthree\nfour');
    await page.keyboard.type('@@');
    await expect.poll(() => value(page)).toBe('- one\n- two\n- three\nfour');
    // What a macro types is one undo step, as typing is.
    await page.keyboard.type('u');
    await expect.poll(() => value(page)).toBe('- one\n- two\nthree\nfour');
    await page.locator('flow-script').evaluate((el) => { el.value = 'one\ntwo\nthree\nfour'; el.selectText(1, 0, 0); });
    await page.keyboard.press('Escape');
    await page.keyboard.type('2@a');
    await expect.poll(() => value(page)).toBe('one\n- two\n- three\nfour');
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

test.describe('extensions with code', () => {
  const MANIFEST = JSON.stringify({
    id: 'stamp', kind: 'app', name: 'Stamp', author: 'Test', main: 'stamp.js',
    icon: { paths: ['M4 4h16v16H4z'] },
  });
  // It counts its stamps in its own storage, and offers itself as a button in the top right.
  const CODE = (word) => `export function activate(flow) {
    flow.addCommand({
      id: 'stamp', label: 'Stamp', icon: 'plus', widget: 'top-end',
      run: async ({ script }) => {
        const count = ((await flow.storage.get('count')) ?? 0) + 1;
        await flow.storage.set('count', count);
        script.insertText('${word} ' + count + ' ');
      },
    });
  }`;
  const trust = (page) => page.locator('dialog.fl-dialog');
  const stampFolder = (word = 'STAMP') => ({ 'manifest.json': MANIFEST, 'stamp.js': CODE(word) });

  test('ask whether the code is trusted, every time, before adding it', async ({ page }) => {
    await addExtensionFolder(page, 'stamp', stampFolder());
    await expect(trust(page).getByRole('heading', { name: 'Do you trust this extension?' })).toBeVisible();
    await expect(trust(page)).toContainText('stamp.js');
    await expect(trust(page)).toContainText('Stamp 1.0.0 by Test');
    // Not trusting is what a quick Enter does.
    await expect(trust(page).locator('#trust-cancel')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(trust(page)).toHaveCount(0);
    await expect(details(page, 'stamp')).toHaveCount(0);

    await settings(page).locator('#add-extension').click();
    await trust(page).locator('#trust-add').click();
    await expect(details(page, 'stamp')).toContainText('Runs its own code');
    // Its own icon, drawn from its path data.
    await expect(details(page, 'stamp').locator('.ext-meta path')).toHaveAttribute('d', 'M4 4h16v16H4z');
    // What someone adds starts on.
    await expect(toggleFor(page, 'stamp')).toBeChecked();

    // An update asks again.
    await settings(page).locator('#add-extension').click();
    await expect(trust(page)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('need the code file their manifest names, in the folder', async ({ page }) => {
    await addExtensionFolder(page, 'stamp', { 'manifest.json': MANIFEST });
    await expect(settings(page).locator('.ext-add-error')).toContainText('This app’s code starts in stamp.js, which isn’t in the folder.');
    await expect(trust(page)).toHaveCount(0);
  });

  test('run once added, from a widget in the top right, and keep their code and data', async ({ page }) => {
    await addExtensionFolder(page, 'stamp', stampFolder());
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

  test('load each file the main one imports', async ({ page }) => {
    await addExtensionFolder(page, 'greeter', {
      'manifest.json': JSON.stringify({ id: 'greeter', kind: 'app', name: 'Greeter', main: 'index.js' }),
      'index.js': `import { greeting } from './words.js';
        export default function (flow) {
          flow.addCommand({ id: 'greet', label: 'Greet', run: ({ script }) => script.insertText(greeting()) });
        }`,
      'words.js': `export const greeting = () => 'Hello there. ';`,
    });
    await expect(trust(page)).toContainText('index.js, words.js');
    await trust(page).locator('#trust-add').click();
    await expect(toggleFor(page, 'greeter')).toBeChecked();
    await page.keyboard.press('Escape');
    await scriptWith(page, 'end');
    await docPill(page).click();
    await docMenu(page).locator('[data-command="greeter.greet"]').click();
    await expect.poll(() => value(page)).toBe('Hello there. end');
  });

  test('update from their folder after their files change, asking about the code again', async ({ page }) => {
    await addExtensionFolder(page, 'stamp', stampFolder());
    await trust(page).locator('#trust-add').click();
    await expect(details(page, 'stamp')).toContainText('From the stamp folder');
    await writeFolder(page, 'stamp', stampFolder('MARK'));
    await details(page, 'stamp').locator('[data-action="update"]').click();
    await expect(trust(page)).toBeVisible();
    await trust(page).locator('#trust-add').click();
    await expect(page.locator('#toast')).toContainText('Updated Stamp from stamp');
    await page.keyboard.press('Escape');
    await scriptWith(page, 'end');
    await page.locator('flow-script .fl-topbar-end').getByRole('button', { name: 'Stamp' }).click();
    await expect.poll(() => value(page)).toBe('MARK 1 end');
  });
});

test.describe('widgets', () => {
  test('a command from JSON can be a button in the top right corner', async ({ page }) => {
    await addExtensionFolder(page, 'scene-start', {
      'manifest.json': JSON.stringify({ id: 'scene-start', kind: 'app', name: 'Scene start', commands: [{ id: 'int', label: 'Insert INT.', icon: 'scene', widget: 'top-end', insert: 'INT. ' }] }),
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

test.describe('multi-line settings', () => {
  test('a text setting with multiline gets a box that grows, kept line for line', async ({ page }) => {
    await addExtensionFolder(page, 'lines', {
      'manifest.json': JSON.stringify({
        id: 'lines', kind: 'app', name: 'Lines',
        settings: [{ key: 'list', type: 'text', multiline: true, label: 'List', default: '' }],
        commands: [{ id: 'noop', label: 'Nothing', insert: ' ' }],
      }),
    });
    await details(page, 'lines').locator('[data-action="settings"]').click();
    const box = settings(page).getByRole('textbox', { name: 'List' });
    await expect(box).toHaveJSProperty('tagName', 'TEXTAREA');
    await box.fill('one\ntwo\nthree\nfour');
    await expect(box).toHaveJSProperty('rows', 5);
    await page.reload();
    await openExtensions(page);
    await details(page, 'lines').locator('[data-action="settings"]').click();
    await expect(settings(page).getByRole('textbox', { name: 'List' })).toHaveValue('one\ntwo\nthree\nfour');
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

test.describe('cloud providers', () => {
  // A provider that has to be connected, as one that signs in would, and remembers it in its storage.
  const register = () => window.flowExtensions.register({
    id: 'sky', kind: 'app', name: 'Sky Drive', icon: { paths: ['M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z'] },
  }, (flow) => {
    let account = null;
    flow.storage.get('account').then((saved) => { account = saved ?? null; });
    flow.addSource({
      id: 'sky', kind: 'cloud', label: 'Sky Drive', description: 'Scripts in the sky',
      status: () => ({ ok: true }),
      connection: () => ({ connected: !!account, account: account ?? '' }),
      connect: async () => {
        account = 'writer@example.com';
        await flow.storage.set('account', account);
        return { connected: true, account };
      },
      disconnect: async () => {
        account = null;
        await flow.storage.delete('account');
      },
      open: async () => ({ name: 'sky.fountain', text: 'EXT. SKY - DAY', ref: {} }),
      save: async () => null, saveAs: async () => null, saveHint: () => 'Saves to the sky.', location: () => '',
    });
  });

  async function turnOnSky(page) {
    await page.goto(HOME);
    await page.evaluate(register);
    await page.locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Extensions', exact: true }).click();
    await toggleFor(page, 'sky').check();
  }

  test('connect on their extension’s own settings page, not a page of sources', async ({ page }) => {
    await turnOnSky(page);
    await expect(rail(page).getByRole('button', { name: 'Sources' })).toHaveCount(0);
    // Its settings page has its connection, though the extension has no settings of its own.
    const tab = rail(page).getByRole('button', { name: 'Sky Drive' });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(settings(page).getByRole('heading', { name: 'Sky Drive', exact: true })).toBeVisible();
    const account = settings(page).locator('.source-account[data-source="sky"]');
    await expect(account).toHaveText('Not connected');
    await settings(page).getByRole('button', { name: 'Connect Sky Drive' }).click();
    await expect(account).toHaveText('Connected: writer@example.com');
    await settings(page).getByRole('button', { name: 'Disconnect Sky Drive' }).click();
    await expect(account).toHaveText('Not connected');
  });

  test('have a sheet beside Open, with their icon, which connects first and then opens', async ({ page }) => {
    await turnOnSky(page);
    await page.keyboard.press('Escape');
    const sheet = page.locator('.shelf [data-provider="sky"]');
    await expect(sheet).toContainText('Sky Drive');
    await expect(sheet.locator('.tile-face path')).toHaveAttribute('d', /^M7 18a4.5/);
    // Open stays this device's own.
    await expect(page.locator('#open-script')).toContainText('From this device');
    await sheet.click();
    await expect.poll(() => value(page)).toBe('EXT. SKY - DAY');
    await expect(page.locator('.doc-where')).toHaveText('Cloud · Sky Drive');
    // Opening connected it. (A reload would lose an extension registered by code.)
    await docPill(page).click();
    await docMenu(page).locator('#home').click();
    await page.locator('#app-settings').click();
    await rail(page).getByRole('button', { name: 'Sky Drive' }).click();
    await expect(settings(page).locator('.source-account[data-source="sky"]')).toHaveText('Connected: writer@example.com');
  });

  test('come and go from the home page with their extension', async ({ page }) => {
    await turnOnSky(page);
    await expect(page.locator('.shelf [data-provider="sky"]')).toBeVisible();
    await toggleFor(page, 'sky').uncheck();
    await expect(page.locator('.shelf [data-provider="sky"]')).toHaveCount(0);
  });
});
