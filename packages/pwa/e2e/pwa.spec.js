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
    await expect(ribbon.getByRole('button', { name: 'Scene', exact: true })).toHaveCSS('font-family', roboto);
    for (const name of ['B', 'I', 'U']) await expect(ribbon.getByRole('button', { name, exact: true })).toHaveCSS('font-family', roboto);
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
    await page.locator('flow-script .fl-ribbon').getByRole('button', { name: 'Page view', exact: true }).click();
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

test('theme choice applies to the app and script, and persists', async ({ page }) => {
  await newScript(page);
  await page.locator('.theme').selectOption('amber-dark');
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'amber-dark');
  await expect(page.locator('.editor-top')).toHaveCSS('background-color', 'rgb(25, 19, 8)');
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'amber-dark');
  await page.goBack();
  await expect(page.locator('.theme')).toHaveValue('amber-dark');
});
