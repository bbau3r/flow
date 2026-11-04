import { test, expect } from '@playwright/test';

const HOME = '/flow/';
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => page.locator('flow-script').evaluate((el) => el.value);
const providerCard = (page, id) => page.locator(`[data-provider="${id}"]`);
const lineWith = (page, text) => page.locator('flow-script .fl-line', { hasText: text }).first();

// The editor takes focus a frame after appearing or saving, and only a focused editor
// marks the active line, so this is the signal that it's safe to type.
const editorFocused = (page) => expect(page.locator('flow-script .fl-active').first()).toBeAttached();

async function newScript(page) {
  await page.goto(HOME);
  await page.locator('#new-script').click();
  await expect(editor(page)).toBeVisible();
  await editorFocused(page);
}

// Real file pickers can't run headless, so these return real file handles from the
// browser's private file system. Everything after the picker is the genuine API.
const fakePickers = () => {
  const root = () => navigator.storage.getDirectory();
  const write = async (name, text) => {
    const handle = await (await root()).getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return handle;
  };
  window.readFile = async (name) => (await (await (await root()).getFileHandle(name)).getFile()).text();
  // Timestamps have millisecond resolution, so make sure this one is visibly later.
  window.writeElsewhere = async (name, text) => {
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await write(name, text);
  };
  window.pickerCalls = [];
  window.showOpenFilePicker = async (options) => {
    window.pickerCalls.push({ kind: 'open', id: options.id });
    return [await write('existing.fountain', 'INT. ROOM - DAY\r\n\r\nFrom disk.')];
  };
  window.showSaveFilePicker = async (options) => {
    window.pickerCalls.push({
      kind: 'save',
      id: options.id,
      suggestedName: options.suggestedName,
      startInName: options.startIn?.name,
    });
    // Confirming the dialog as offered, unless a test chooses a different file.
    if (window.pickerCancels) throw new DOMException('cancelled', 'AbortError');
    return (await root()).getFileHandle(window.pickerChoice ?? options.suggestedName, { create: true });
  };
};

test.describe('home page', () => {
  test('offers a new script, or opening one from the device', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(providerCard(page, 'local')).toBeEnabled();
    await expect(providerCard(page, 'local')).toContainText('This device');
    await expect(page.locator('section', { hasText: 'Open a script' }).locator('.card')).toHaveCount(1);
  });

  test('never mentions or contacts Google', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(HOME);
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/google|drive/i);
    await page.locator('#new-script').click();
    await expect(editor(page)).toBeVisible();
    await page.locator('#save-as').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    expect(requests.filter((u) => /google/i.test(u))).toEqual([]);
  });

  test('fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto(HOME);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('new scripts', () => {
  test('start with a full title page that can be edited down', async ({ page }) => {
    await newScript(page);
    const text = await value(page);
    for (const key of ['Title:', 'Credit:', 'Author:', 'Source:', 'Draft date:', 'Contact:', 'Copyright:', 'Notes:']) {
      expect(text).toContain(key);
    }
    await expect(lineWith(page, 'Untitled Screenplay')).toHaveClass(/fl-title/);
    await expect(lineWith(page, 'Written by')).toHaveClass(/fl-title/);

    // Removing a field is just deleting its line.
    const source = lineWith(page, 'Based on the novel');
    await source.click();
    // Home can only reach the "Source:" label once clicking has revealed it.
    await expect(source).toHaveClass(/fl-active/);
    // The editor learns about selection changes asynchronously, so go at a human pace.
    await page.keyboard.press('Home', { delay: 30 });
    await page.keyboard.press('Shift+End', { delay: 30 });
    await page.waitForTimeout(100);
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    const edited = await value(page);
    expect(edited).not.toContain('Source:');
    expect(edited).toContain('Author:');
  });

  test('open on the cover page with the title ready to type over', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 });
    await newScript(page);
    const scrolled = await page.locator('flow-script').evaluate((el) => el.shadowRoot.querySelector('.fl-scroll').scrollTop);
    expect(scrolled).toBe(0);
    await expect(lineWith(page, 'Written by')).toBeInViewport();
    await page.keyboard.type('My Film');
    const lines = (await value(page)).split('\n');
    expect(lines[0]).toBe('Title: My Film');
    expect(lines[1]).toBe('Credit: Written by');
    await expect(page.locator('.doc-name')).toHaveText('My Film');
  });

  test('use Roboto for the interface and Courier only for the script and icons', async ({ page }) => {
    await newScript(page);
    const roboto = /^Roboto/;
    const courier = /^"Courier Prime"/;
    await expect(page.locator('.doc-name')).toHaveCSS('font-family', roboto);
    await expect(page.locator('#save')).toHaveCSS('font-family', roboto);
    const ribbon = page.locator('flow-script .fl-ribbon');
    await expect(ribbon.locator('.fl-topics .fl-menu-trigger')).toHaveCSS('font-family', roboto);
    for (const name of ['Bold', 'Italic', 'Underline']) await expect(ribbon.getByRole('button', { name, exact: true })).toHaveCSS('font-family', roboto);
    await expect(page.locator('flow-script .fl-icon-glyph').first()).toHaveCSS('font-family', courier);
    await expect(lineWith(page, 'Written by')).toHaveCSS('font-family', courier);
    await page.goBack();
    await expect(page.locator('h1')).toHaveCSS('font-family', roboto);
    await expect(page.locator('.brand')).toHaveCSS('font-family', roboto);
    await page.waitForFunction(() => [...document.fonts].filter((f) => f.family.includes('Roboto') && f.status === 'loaded').length === 3);
  });

  test('open as pages on a big screen and continuous text on a phone', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('flow-script .fl-sheet')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await page.reload();
    await expect(page.locator('flow-script .fl-flow')).toBeVisible();
    const bar = page.locator('flow-script .fl-statusbar');
    await bar.locator('.fl-menu-trigger').click();
    await bar.getByRole('menuitemradio', { name: 'Paged', exact: true }).click();
    await expect(page.locator('flow-script .fl-sheet')).toBeVisible();
  });

  test('take their name from the title until first saved', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('.doc-name')).toHaveText('Untitled Screenplay');
    await lineWith(page, 'Untitled Screenplay').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Two');
    await expect(page.locator('.doc-name')).toHaveText('Untitled Screenplay Two');
    await expect(page.locator('.doc-state')).toHaveText('On this device only');
  });
});

test.describe('autosave and recent', () => {
  test('work survives a reload, and returns through the recent list', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('Typed before reload.');
    await page.waitForTimeout(500);
    await page.reload();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toContain('Typed before reload.');

    await page.locator('.home-link').click();
    const row = page.locator('.recent-row', { hasText: 'Typed before reload.' });
    await expect(row).toContainText('unsaved changes');
    await row.locator('.recent-open').click();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toContain('Typed before reload.');
  });

  test('leaving right after typing keeps the text', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('Quick exit.');
    await page.locator('.home-link').click();
    await page.locator('.recent-open').first().click();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toContain('Quick exit.');
  });

  test('browser back returns home', async ({ page }) => {
    await newScript(page);
    await page.goBack();
    await expect(page.locator('#new-script')).toBeVisible();
  });

  test('removing unsaved work asks first', async ({ page }) => {
    await newScript(page);
    await page.locator('.home-link').click();
    const rows = page.locator('.recent-row');
    await expect(rows).toHaveCount(1);
    page.once('dialog', (d) => d.dismiss());
    await rows.locator('.recent-remove').click();
    await expect(rows).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await rows.locator('.recent-remove').click();
    await expect(rows).toHaveCount(0);
  });

  test('an unknown script link falls back to home', async ({ page }) => {
    await page.goto(`${HOME}#/edit/nothing-here`);
    await expect(page.locator('#new-script')).toBeVisible();
  });
});

test.describe('local files with direct saving', () => {
  test.beforeEach(({ page }) => page.addInitScript(fakePickers));

  test('opens, edits and saves back to the same file', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toBe('INT. ROOM - DAY\n\nFrom disk.');
    await expect(page.locator('.doc-name')).toHaveText('existing.fountain');
    await expect(page.locator('.doc-state')).toHaveText('Saved');

    await lineWith(page, 'From disk').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Edited.');
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await page.keyboard.press('Control+s');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toBe('INT. ROOM - DAY\n\nFrom disk. Edited.');
    await expect(page.locator('.doc-name')).toHaveText('existing.fountain');
  });

  test('save opens the OS dialog in the file\u2019s folder with its name filled in', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('.doc-where')).toContainText('On this device');
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('Z');
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('dialog')).toHaveCount(0);
    const saves = (await page.evaluate(() => window.pickerCalls)).filter((c) => c.kind === 'save');
    expect(saves).toEqual([{ kind: 'save', suggestedName: 'existing.fountain', startInName: 'existing.fountain' }]);
  });

  test('choosing another file in the dialog moves the script there', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await page.evaluate(() => { window.pickerChoice = 'elsewhere.fountain'; });
    await page.locator('#save').click();
    await expect(page.locator('.doc-name')).toHaveText('elsewhere.fountain');
    expect(await page.evaluate(() => window.readFile('elsewhere.fountain'))).toContain('From disk');

    // The next save starts from the new file.
    await page.locator('#save').click();
    await expect.poll(async () => (await page.evaluate(() => window.pickerCalls)).at(-1).startInName).toBe('elsewhere.fountain');
  });

  test('cancelling the OS dialog changes nothing', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('Z');
    await page.evaluate(() => { window.pickerCancels = true; });
    await page.locator('#save').click();
    await expect.poll(async () => (await page.evaluate(() => window.pickerCalls)).filter((c) => c.kind === 'save').length).toBe(1);
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await expect(page.locator('#toast')).toBeHidden();
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).not.toContain('Z');
  });

  test('save as also goes straight to the OS dialog', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await page.locator('#save-as').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const save = (await page.evaluate(() => window.pickerCalls)).find((c) => c.kind === 'save');
    expect(save).toEqual({ kind: 'save', suggestedName: 'existing.fountain', startInName: 'existing.fountain' });
  });

  test('a first save asks where, and suggests a name from the title', async ({ page }) => {
    await newScript(page);
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const save = (await page.evaluate(() => window.pickerCalls)).find((c) => c.kind === 'save');
    expect(save).toEqual({ kind: 'save', id: 'flow-scripts', suggestedName: 'Untitled Screenplay.fountain' });
  });

  test('a title on several lines is saved with dashes in the file name', async ({ page }) => {
    await newScript(page);
    await page.locator('flow-script').evaluate((el) => { el.value = 'Title:\n    The Long\n    Way Home\n\nAction.'; });
    await page.locator('flow-script .fl-line', { hasText: 'Way Home' }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    await page.keyboard.type('!');
    await expect(page.locator('.doc-name')).toHaveText('The Long · Way Home!');
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const save = (await page.evaluate(() => window.pickerCalls)).find((c) => c.kind === 'save');
    expect(save.suggestedName).toBe('The Long - Way Home!.fountain');
  });

  test('a script with no file to return to asks where instead of downloading', async ({ page }) => {
    await newScript(page);
    await page.locator('.home-link').click();
    await page.evaluate(() => new Promise((resolve) => {
      const open = indexedDB.open('flow', 1);
      open.onsuccess = () => {
        const store = open.result.transaction('docs', 'readwrite').objectStore('docs');
        store.getAll().onsuccess = (event) => {
          const [doc] = event.target.result;
          store.put({ ...doc, provider: 'local', ref: { downloaded: true }, savedValue: 'older' }).onsuccess = resolve;
        };
      };
    }));
    await page.reload();
    await page.locator('.recent-open').first().click();
    await expect(editor(page)).toBeVisible();
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect((await page.evaluate(() => window.pickerCalls)).filter((c) => c.kind === 'save')).toHaveLength(1);
  });

  test('a file reopened from the recent list still saves back to it', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await page.reload();
    await page.locator('.home-link').click();
    await page.locator('.recent-open').first().click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('Y');
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toContain('Y');
  });

  test('a new script goes straight to the OS dialog, then keeps saving there', async ({ page }) => {
    await newScript(page);
    await page.locator('#save').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('.doc-name')).toHaveText('Untitled Screenplay.fountain');
    expect(await page.evaluate(() => window.readFile('Untitled Screenplay.fountain'))).toContain('Title: Untitled Screenplay');

    await editorFocused(page);
    await page.keyboard.type('More.');
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await page.locator('#save').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('Untitled Screenplay.fountain'))).toContain('More.');
  });

  test('cancelling the open picker stays home', async ({ page }) => {
    await page.goto(HOME);
    await page.evaluate(() => {
      window.showOpenFilePicker = async () => { throw new DOMException('cancelled', 'AbortError'); };
    });
    await providerCard(page, 'local').click();
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(page.locator('#toast')).toBeHidden();
  });

  test('a file changed elsewhere is not overwritten without asking', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('X');
    await page.evaluate(() => window.writeElsewhere('existing.fountain', 'Changed elsewhere.'));

    page.once('dialog', (d) => d.dismiss());
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toBe('Changed elsewhere.');

    page.once('dialog', (d) => d.accept());
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toContain('From disk');
  });
});

test('without folder access, Flow explains why it downloaded', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
    delete Window.prototype.showOpenFilePicker;
    delete Window.prototype.showSaveFilePicker;
  });
  await newScript(page);
  const download = page.waitForEvent('download');
  await page.locator('#save').click();
  await download;
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('can\u2019t ask where to save');
});

test.describe('local files without direct saving, as on iOS', () => {
  test.beforeEach(({ page }) => page.addInitScript(() => {
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
    delete Window.prototype.showOpenFilePicker;
    delete Window.prototype.showSaveFilePicker;
  }));

  test('opens through a file input and saves by downloading', async ({ page }) => {
    await page.goto(HOME);
    const chooser = page.waitForEvent('filechooser');
    await providerCard(page, 'local').click();
    await (await chooser).setFiles({ name: 'phone.fountain', mimeType: 'text/plain', buffer: Buffer.from('From a phone.') });
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toBe('From a phone.');

    await expect(page.locator('.doc-where')).toContainText('Downloaded copy');
    await lineWith(page, 'From a phone').click();
    await page.keyboard.type('X');
    const download = page.waitForEvent('download');
    await page.locator('#save').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('phone.fountain');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('#toast')).toContainText('Downloaded');
  });
});

test.describe('installable and offline', () => {
  test('has a valid manifest and icons, relative to where it is hosted', async ({ page, request }) => {
    await page.goto(HOME);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href, page.url());
    expect(manifestUrl.pathname.startsWith(HOME)).toBe(true);
    const manifest = await (await request.get(manifestUrl.href)).json();
    expect(manifest.name).toBe('Flow');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toBe('image/png');
    }
  });

  test('never reaches outside its own path', async ({ page }) => {
    const urls = [];
    page.on('request', (r) => urls.push(new URL(r.url())));
    await newScript(page);
    const local = urls.filter((u) => u.hostname === 'localhost');
    expect(local.length).toBeGreaterThan(3);
    expect(local.filter((u) => !u.pathname.startsWith(HOME))).toEqual([]);
    expect(urls.filter((u) => u.hostname !== 'localhost' && u.protocol.startsWith('http'))).toEqual([]);
  });

  test('works fully offline after one visit', async ({ page, context }) => {
    await page.goto(HOME);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.badge', { hasText: 'Offline' })).toBeVisible();
    await expect(providerCard(page, 'local')).toBeEnabled();

    await page.locator('#new-script').click();
    await expect(editor(page)).toBeVisible();
    await editorFocused(page);
    await page.keyboard.type('Written offline.');
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === 'loaded').length;
    });
    expect(fonts).toBeGreaterThan(0);
    const pdf = await page.locator('flow-script').evaluate(async (el) => (await el.exportPdf()).pageCount);
    expect(pdf).toBe(2);

    await page.waitForTimeout(500);
    await page.reload();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toContain('Written offline.');
  });
});

const themeItem = (page, name) => page.locator('.theme').getByRole('menuitemradio', { name, exact: true });

async function chooseTheme(page, name) {
  await page.locator('.theme .fl-menu-trigger').click();
  await themeItem(page, name).click();
}

test('theme choice applies to the app and script, and persists', async ({ page }) => {
  await newScript(page);
  await chooseTheme(page, 'Ocean');
  await chooseTheme(page, 'Dark');
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'ocean-dark');
  await expect(page.locator('.doc-pill')).toHaveCSS('color', 'rgb(191, 230, 245)');
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'ocean-dark');
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean-dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 29, 30)');
  await page.locator('.theme .fl-menu-trigger').click();
  await expect(themeItem(page, 'Ocean')).toHaveAttribute('aria-checked', 'true');
  await expect(themeItem(page, 'Dark')).toHaveAttribute('aria-checked', 'true');
  await expect(themeItem(page, 'Amber')).toHaveAttribute('aria-checked', 'false');
});

test('every theme can be chosen from the menu and fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await newScript(page);
  for (const [name, theme] of [['Amber', 'amber'], ['Ocean', 'ocean'], ['Volcano', 'volcano'], ['Forest', 'forest'], ['Tulip', 'tulip']]) {
    await chooseTheme(page, name);
    await expect(page.locator('flow-script')).toHaveAttribute('theme', `${theme}-auto`);
    await page.locator('.theme .fl-menu-trigger').click();
    await themeItem(page, 'Dark').scrollIntoViewIfNeeded();
    await expect(themeItem(page, 'Dark')).toBeInViewport();
    await page.locator('.theme .fl-menu-trigger').click();
  }
});

test('the theme menu headings are bold on a contrasting background', async ({ page }) => {
  await page.goto(HOME);
  await page.locator('.theme .fl-menu-trigger').click();
  const headings = page.locator('.theme .fl-menu-heading');
  await expect(headings).toHaveText(['Theme', 'Mode']);
  for (const heading of await headings.all()) {
    await expect(heading).toHaveCSS('font-weight', '700');
    await expect(heading).toHaveCSS('background-color', 'rgb(180, 83, 9)');
    await expect(heading).toHaveCSS('color', 'rgb(255, 250, 240)');
  }
});

test('on a small screen the theme shows only its palette icon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await newScript(page);
  const trigger = page.locator('.theme .fl-menu-trigger');
  const name = trigger.locator('.fl-compact-hide');
  const palette = trigger.locator('.fl-svg').first();
  await expect(name).toHaveText('Amber');
  await expect(name).toBeVisible();
  await expect(palette).toBeVisible();

  await page.setViewportSize({ width: 390, height: 700 });
  await expect(name).toBeHidden();
  await expect(palette).toBeVisible();
  await expect(trigger.locator('.fl-swatch')).toHaveCount(0);
  // The name stays available to screen readers and the tooltip.
  await expect(trigger).toHaveAttribute('aria-label', /Amber/);
  await expect(trigger).toHaveAttribute('title', /Amber/);

  // The menu still lists every name, and the home page does the same.
  await trigger.click();
  await expect(themeItem(page, 'Tulip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.home-link').click();
  await expect(page.locator('#new-script')).toBeVisible();
  await expect(page.locator('.theme .fl-compact-hide')).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(page.locator('.theme .fl-compact-hide')).toBeVisible();
});

test('a theme saved by an older version still loads', async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate(() => localStorage.setItem('flow-theme', 'auto'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber-auto');
  await page.evaluate(() => localStorage.setItem('flow-theme', 'amber-dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber-dark');
});

test.describe('editor bars', () => {
  test('on one row, everything runs document, tabs, formatting, then export', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const box = (locator) => locator.boundingBox();
    const doc = await box(page.locator('.doc-pill'));
    const tabs = await box(page.getByRole('tablist', { name: 'Workspace' }));
    const format = await box(page.locator('flow-script .fl-ribbon'));
    const exportPill = await box(page.locator('flow-script .fl-export'));
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(format.x);
    expect(format.x + format.width).toBeLessThanOrEqual(exportPill.x);
    expect(exportPill.x + exportPill.width).toBeCloseTo(1268, 0);
    const middle = doc.y + doc.height / 2;
    for (const other of [tabs, format, exportPill]) expect(Math.abs(other.y + other.height / 2 - middle)).toBeLessThan(2);
  });

  test('a very long title gives way before the row breaks', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await newScript(page);
    await page.keyboard.type('A very long title indeed '.repeat(8));
    await expect(page.locator('.doc-name')).toContainText('A very long');
    const doc = await page.locator('.doc-pill').boundingBox();
    const tabs = await page.getByRole('tablist', { name: 'Workspace' }).boundingBox();
    const exportPill = await page.locator('flow-script .fl-export').boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(exportPill.x + exportPill.width).toBeLessThanOrEqual(1000);
    expect(Math.abs(tabs.y - exportPill.y)).toBeLessThan(8);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
  });

  test('on two rows, formatting leans left beneath the document and tabs', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await newScript(page);
    const doc = await page.locator('.doc-pill').boundingBox();
    const tabs = await page.getByRole('tablist', { name: 'Workspace' }).boundingBox();
    const save = await page.locator('#save').boundingBox();
    const bold = await page.locator('flow-script .fl-ribbon').getByRole('button', { name: 'Bold', exact: true }).boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(save.x);
    expect(bold.y).toBeGreaterThanOrEqual(doc.y + doc.height - 1);
    expect(bold.x).toBeLessThan(25);
  });

  test('the theme menu matches the small bottom pills beside it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const bar = page.locator('flow-script .fl-statusbar');
    const theme = await page.locator('.theme .fl-menu-trigger').boundingBox();
    const larger = await bar.getByRole('button', { name: 'Larger' }).boundingBox();
    const undo = await bar.getByRole('button', { name: 'Undo', exact: true }).boundingBox();
    const bold = await page.locator('flow-script .fl-ribbon').getByRole('button', { name: 'Bold', exact: true }).boundingBox();
    expect(theme.height).toBeCloseTo(larger.height, 0);
    expect(undo.height).toBeCloseTo(theme.height, 0);
    expect(larger.height).toBeLessThan(bold.height);

    // Undo and redo sit directly left of the theme, in pills of the same height.
    const pills = page.locator('flow-script .fl-statusbar .fl-pill').filter({ has: page.getByRole('button', { name: 'Undo', exact: true }) });
    const historyPill = await pills.boundingBox();
    const themePill = await page.locator('.theme').locator('xpath=ancestor::*[contains(@class, "fl-pill")][1]').boundingBox();
    expect(historyPill.x + historyPill.width).toBeLessThanOrEqual(themePill.x);
    expect(themePill.x - (historyPill.x + historyPill.width)).toBeLessThan(12);
    expect(historyPill.height).toBeCloseTo(themePill.height, 0);
    await expect(page.locator('.theme .fl-menu-trigger .fl-svg').first()).toBeVisible();
  });

  test('every pill in the top rows floats the same way, and all still work', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const shadowOf = (locator) => locator.evaluate((el) => getComputedStyle(el).boxShadow);
    const doc = page.locator('.doc-pill');
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const expected = await shadowOf(page.locator('flow-script .fl-ribbon .fl-pill').first());
    expect(await shadowOf(doc)).toBe(expected);
    expect(await shadowOf(tabs)).toBe(expected);
    expect(await shadowOf(page.locator('flow-script .fl-export'))).toBe(expected);

    await page.locator('flow-script').evaluate((el) => { el.value = 'Beat.\n\n'.repeat(300); });
    await page.locator('flow-script .fl-scroll').evaluate((el) => { el.scrollTop = 900; });
    const box = await doc.boundingBox();
    expect(box.y).toBeLessThan(20);
    await expect(page.locator('.home-link')).toBeInViewport();
    await page.locator('.home-link').click();
    await expect(page.locator('#new-script')).toBeVisible();
  });

  for (const width of [1280, 900, 390]) {
    test(`the document and tabs pills match in height and padding at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await newScript(page);
      const doc = page.locator('.doc-pill');
      const tabs = width > 600 ? page.getByRole('tablist', { name: 'Workspace' }) : page.locator('.fl-compact-only .fl-tabs');
      const docBox = await doc.boundingBox();
      const tabsBox = await tabs.boundingBox();
      expect(tabsBox.height).toBeCloseTo(docBox.height, 0);
      expect(tabsBox.y).toBeCloseTo(docBox.y, 0);
      const paddings = (locator) => locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.paddingTop, style.paddingBottom, style.paddingLeft];
      });
      expect(await paddings(tabs)).toEqual(await paddings(doc));
      // What's inside fills the pill, so the padding looks the same on screen too.
      const inner = width > 600 ? page.getByRole('tab', { name: 'Write' }) : page.getByRole('button', { name: 'Workspace: Write' });
      const innerBox = await inner.boundingBox();
      expect(innerBox.y - tabsBox.y).toBeCloseTo(4, 0);
      expect(tabsBox.y + tabsBox.height - (innerBox.y + innerBox.height)).toBeCloseTo(4, 0);
    });
  }

  test('the small-screen tab dropdown is bold in the same font as the tabs, with no background', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const font = await page.getByRole('tab', { name: 'Write' }).evaluate((el) => {
      const style = getComputedStyle(el);
      return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
    });
    await page.setViewportSize({ width: 390, height: 700 });
    const dropdown = page.getByRole('button', { name: 'Workspace: Write' });
    await expect(dropdown).toHaveCSS('font-family', font.family);
    await expect(dropdown).toHaveCSS('font-size', font.size);
    await expect(dropdown).toHaveCSS('font-weight', font.weight);
    await page.mouse.move(0, 0);
    await expect(dropdown).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('the document and tabs are separate secondary pills, leaning left', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await newScript(page);
    const accent = 'rgb(180, 83, 9)';
    const doc = page.locator('.doc-pill');
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const docBox = await doc.boundingBox();
    const tabsBox = await tabs.boundingBox();

    // Side by side at the left, with a gap between, even with room left over.
    expect(tabsBox.x).toBeGreaterThan(docBox.x + docBox.width);
    expect(tabsBox.x - (docBox.x + docBox.width)).toBeLessThan(12);
    expect(tabsBox.x + tabsBox.width).toBeLessThan(450);

    // Both are the same lighter tint, with the current tab in primary.
    const background = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    const tint = await background(doc);
    expect(tint).not.toBe(accent);
    expect(await background(tabs)).toBe(tint);
    await expect(page.getByRole('tab', { name: 'Write' })).toHaveCSS('background-color', accent);
    const shadow = (locator) => locator.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(await shadow(tabs)).toBe(await shadow(doc));
    expect(await shadow(tabs)).not.toBe('none');

    // The small-screen dropdown keeps the same pill.
    await page.setViewportSize({ width: 390, height: 700 });
    const small = page.getByRole('button', { name: 'Workspace: Write' });
    await expect(small).toBeVisible();
    expect(await small.evaluate((el) => getComputedStyle(el.closest('.fl-pill')).backgroundColor)).toBe(tint);

    // Preview hides the tabs, leaving the document.
    await page.setViewportSize({ width: 1280, height: 700 });
    const bar = page.locator('flow-script .fl-statusbar');
    await bar.locator('.fl-menu-trigger').click();
    await bar.getByRole('menuitemradio', { name: 'Preview', exact: true }).click();
    await expect(tabs).toBeHidden();
    await expect(doc).toBeVisible();
  });

  test('the document pill shows title, date and source, and leads home', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('.doc-date')).toHaveText(new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
    await expect(page.locator('.doc-state')).toBeVisible();
    await expect(page.locator('.home-link')).toHaveAttribute('aria-label', 'Home');
    await expect(page.locator('.home-link .fl-svg')).toBeVisible();
    await page.locator('.home-link').click();
    await expect(page.locator('#new-script')).toBeVisible();
  });

  test('Write is the current tab, and Outline switches to the cards and back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await expect(page.getByRole('tab', { name: 'Write' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Outline' }).click();
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('flow-script .ProseMirror')).toBeHidden();
    await page.getByRole('button', { name: 'Add act', exact: true }).click();
    await page.keyboard.type('Act One');
    await page.getByRole('tab', { name: 'Write' }).click();
    await expect(page.locator('flow-script .fl-line', { hasText: 'Act One' })).toBeVisible();
    await expect(page.locator('.doc-state')).toHaveText('On this device only');
  });

  test('the document pill joins a title on several lines with separators', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await page.locator('flow-script').evaluate((el) => { el.value = 'Title:\n    The Long\n    Way Home\nAuthor: Me\n\nAction.'; });
    await page.locator('flow-script .fl-line', { hasText: 'Way Home' }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    await page.keyboard.type('!');
    await expect(page.locator('.doc-name')).toHaveText('The Long · Way Home!');
  });

  test('Write comes first, and the address remembers the tab through a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await expect(page.getByRole('tab')).toHaveText(['Write', 'Outline']);
    expect(page.url()).not.toContain('tab=');

    await page.getByRole('tab', { name: 'Outline' }).click();
    expect(page.url()).toMatch(/#\/edit\/[^?]+\?tab=outline$/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Add act', exact: true })).toBeVisible();
    await expect(page.locator('flow-script .ProseMirror')).toBeHidden();

    await page.getByRole('tab', { name: 'Write' }).click();
    expect(page.url()).not.toContain('tab=');
    await expect(page.locator('flow-script .ProseMirror')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Write' })).toHaveAttribute('aria-selected', 'true');
  });

  test('switching tabs keeps the script open with its unsaved work', async ({ page }) => {
    await newScript(page);
    await page.getByRole('tab', { name: 'Outline' }).click();
    await page.getByRole('button', { name: 'Add act', exact: true }).click();
    await page.keyboard.type('Kept');
    await page.goBack();
    await expect(page.locator('#new-script')).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('flow-script .fl-outline-field').first()).toHaveValue('Kept');
  });

  test('preview hides the formatting controls and tabs, and only those', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const bar = page.locator('flow-script .fl-statusbar');
    const ribbon = page.locator('flow-script .fl-ribbon');
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const exportPill = page.locator('flow-script .fl-export');
    const saveBefore = await page.locator('#save').boundingBox();
    const chooseView = async (name) => {
      await bar.locator('.fl-menu-trigger').click();
      await bar.getByRole('menuitemradio', { name, exact: true }).click();
    };

    await chooseView('Preview');
    await expect(ribbon).toBeHidden();
    await expect(tabs).toBeHidden();
    await expect(page.locator('.doc-pill')).toBeVisible();
    await expect(exportPill).toBeVisible();
    await expect(bar).toBeVisible();
    // Nothing else in the top row moves.
    expect((await page.locator('#save').boundingBox()).x).toBeCloseTo(saveBefore.x, 0);

    await page.setViewportSize({ width: 390, height: 700 });
    await expect(page.getByRole('button', { name: 'Workspace: Write' })).toBeHidden();
    await expect(page.locator('flow-script .fl-export-holder').getByRole('button', { name: 'Export', exact: true })).toBeInViewport({ ratio: 1 });

    await page.setViewportSize({ width: 1280, height: 700 });
    await chooseView('Paged');
    await expect(ribbon).toBeVisible();
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  });

  test('page scale is remembered between scripts', async ({ page }) => {
    await newScript(page);
    const bar = page.locator('flow-script .fl-statusbar');
    await bar.getByRole('button', { name: 'Larger' }).click();
    await expect(bar.locator('.fl-scale')).toHaveText('110%');
    await newScript(page);
    const percent = page.locator('flow-script .fl-statusbar .fl-scale');
    await expect(percent).toHaveText('110%');
    await percent.click();
    await expect(percent).toHaveText('100%');
    await newScript(page);
    await expect(page.locator('flow-script .fl-statusbar .fl-scale')).toHaveText('100%');
  });

  for (const width of [320, 390, 560]) {
    test(`nothing overflows sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await newScript(page);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways).toBeLessThanOrEqual(0);
      await expect(page.locator('flow-script .fl-export-holder').getByRole('button', { name: 'Export', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.theme .fl-menu-trigger')).toBeInViewport({ ratio: 1 });
      const name = await page.locator('.doc-pill').boundingBox();
      expect(name.x + name.width).toBeLessThanOrEqual(width);
    });
  }

  test('export buttons are icons, then a menu as the screen narrows', async ({ page }) => {
    const exportPill = page.locator('flow-script .fl-export');
    const holder = page.locator('flow-script .fl-export-holder');
    const more = holder.getByRole('button', { name: 'Export', exact: true });
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await expect(more).toBeHidden();

    for (const width of [1280, 900, 700, 601]) {
      await page.setViewportSize({ width, height: 700 });
      for (const name of ['Save', 'Save as', 'PDF']) {
        const b = exportPill.getByRole('button', { name, exact: true });
        await expect(b.locator('.fl-svg')).toBeVisible();
        await expect(b.locator('.fl-label')).toHaveCount(0);
        await expect(b).toHaveAttribute('title', /./);
        await expect(b).toBeInViewport({ ratio: 1 });
      }
      await expect(more).toBeHidden();
      await expect(page.getByRole('tablist', { name: 'Workspace' })).toBeVisible();
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways).toBeLessThanOrEqual(0);
    }

    await page.setViewportSize({ width: 600, height: 700 });
    await expect(exportPill).toBeHidden();
    await expect(more).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workspace: Write' })).toBeVisible();
  });

  test('a small screen fits the document, tab and export menus on one row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await newScript(page);
    const doc = await page.locator('.doc-pill').boundingBox();
    const tabMenu = page.getByRole('button', { name: 'Workspace: Write' });
    const exportMenu = page.locator('flow-script .fl-export-holder').getByRole('button', { name: 'Export', exact: true });
    const tab = await tabMenu.boundingBox();
    const more = await exportMenu.boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tab.x);
    expect(tab.x + tab.width).toBeLessThanOrEqual(more.x);
    expect(Math.abs((doc.y + doc.height / 2) - (tab.y + tab.height / 2))).toBeLessThan(2);
    expect(Math.abs((doc.y + doc.height / 2) - (more.y + more.height / 2))).toBeLessThan(2);
    await expect(page.locator('.fl-wide-only .fl-tab').first()).toBeHidden();

    await tabMenu.click();
    await expect(page.getByRole('menuitemradio', { name: 'Write' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: 'Outline' }).click();
    await expect(page.getByRole('button', { name: 'Workspace: Outline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add act', exact: true })).toBeVisible();

    await exportMenu.click();
    const holder = page.locator('flow-script .fl-export-holder');
    for (const name of ['Save', 'Save as', 'PDF']) await expect(holder.getByRole('menuitem', { name, exact: true })).toBeVisible();
  });

  test('saving works from the export menu on a small screen', async ({ page }) => {
    await page.addInitScript(fakePickers);
    await page.setViewportSize({ width: 390, height: 700 });
    await newScript(page);
    const holder = page.locator('flow-script .fl-export-holder');
    await holder.getByRole('button', { name: 'Export', exact: true }).click();
    await holder.getByRole('menuitem', { name: 'Save', exact: true }).click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
  });
});
