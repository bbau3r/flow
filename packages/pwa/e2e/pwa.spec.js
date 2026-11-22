import { test, expect } from '@playwright/test';

const HOME = '/flow/';
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => page.locator('flow-script').evaluate((el) => el.value);
const providerCard = (page, id) => page.locator(`[data-provider="${id}"]`);
const lineWith = (page, text) => page.locator('flow-script .fl-line', { hasText: text }).first();
const docPill = (page) => page.locator('flow-script .fl-docmenu-trigger');
const docMenu = (page) => page.locator('flow-script .fl-docmenu');

// Runs an item of the Document menu, by its id: home, save, save-as, theme or app-settings.
async function fromMenu(page, id) {
  await docPill(page).click();
  await docMenu(page).locator(`#${id}`).click();
}

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
    await expect(page.locator('#new-script')).toHaveText('New');
    await expect(providerCard(page, 'local')).toBeEnabled();
    await expect(providerCard(page, 'local')).toContainText('From this device');
    await expect(page.locator('#open-script')).toHaveCount(1);
  });

  test('shows recent scripts by their title pages beside New and Open, all with the same corners', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('Cover Story');
    await page.waitForTimeout(500);
    await fromMenu(page, 'home');
    const card = page.locator('.recent-row', { hasText: 'Cover Story' });
    await expect(card.locator('.cover-title')).toHaveText('Cover Story');
    await expect(card.locator('.cover-author')).toHaveText('Your Name');
    const radius = (locator) => locator.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const corners = await radius(card.locator('.cover'));
    expect(await radius(page.locator('.tile-new'))).toBe(corners);
    expect(await radius(page.locator('.tile-open'))).toBe(corners);
    // New and Open come first, then the scripts, in a row.
    const open = await page.locator('#open-script').boundingBox();
    expect((await card.boundingBox()).x).toBeGreaterThan(open.x + open.width);
  });

  test('the search finds recent scripts by name or title page', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('Lighthouse');
    await page.waitForTimeout(500);
    await fromMenu(page, 'home');
    await page.locator('#new-script').click();
    await expect(editor(page)).toBeVisible();
    await page.waitForTimeout(500);
    await fromMenu(page, 'home');
    await expect(page.locator('.recent-row')).toHaveCount(2);
    const search = page.getByRole('searchbox', { name: 'Search scripts' });
    await search.fill('lighthouse');
    await expect(page.locator('.recent-row:visible')).toHaveCount(1);
    await search.fill('nothing like this');
    await expect(page.locator('.recent-row:visible')).toHaveCount(0);
    await expect(page.locator('.home-empty')).toContainText('No scripts match');
  });

  test('never mentions or contacts Google', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(HOME);
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/google|drive/i);
    await page.locator('#new-script').click();
    await expect(editor(page)).toBeVisible();
    await fromMenu(page, 'save-as');
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
    await expect(lineWith(page, 'Untitled')).toHaveClass(/fl-title/);
    await expect(lineWith(page, 'Written by')).toHaveClass(/fl-title/);

    // Removing a field is just deleting its line.
    const source = lineWith(page, 'Based On Blank');
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
    await docPill(page).click();
    await expect(docMenu(page).locator('#save')).toHaveCSS('font-family', roboto);
    await page.keyboard.press('Escape');
    const ribbon = page.locator('flow-script .fl-ribbon');
    await expect(ribbon.locator('.fl-topics .fl-menu-trigger')).toHaveCSS('font-family', roboto);
    for (const name of ['Bold', 'Italic', 'Underline']) await expect(ribbon.getByRole('button', { name, exact: true })).toHaveCSS('font-family', roboto);
    await expect(page.locator('flow-script .fl-icon-glyph').first()).toHaveCSS('font-family', courier);
    await expect(lineWith(page, 'Written by')).toHaveCSS('font-family', courier);
    await page.goBack();
    await expect(page.locator('.tile-label').first()).toHaveCSS('font-family', roboto);
    // The rest of the wordmark runs from secondary to primary.
    await expect(page.locator('.brand > span')).toHaveCSS('background-image', /linear-gradient\(135deg/);
    await expect(page.locator('.brand')).toHaveCSS('font-family', roboto);
    // The mark stands in for the F of the wordmark.
    await expect(page.getByRole('img', { name: 'Flow' })).toHaveText('low');
    await expect(page.locator('.brand .flow-mark')).toBeVisible();
    await page.waitForFunction(() => [...document.fonts].filter((f) => f.family.includes('Roboto') && f.status === 'loaded').length === 3);
  });

  test('open as continuous text on any screen, with pages a choice away', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('flow-script .fl-flow')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await page.reload();
    await expect(page.locator('flow-script .fl-flow')).toBeVisible();
    const bar = page.locator('flow-script .fl-statusbar');
    await bar.locator('.fl-menu-trigger:visible').click();
    await bar.getByRole('menuitemradio', { name: 'Paged', exact: true }).click();
    await expect(page.locator('flow-script .fl-sheet')).toBeVisible();
  });

  test('take their name from the title until first saved', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('.doc-name')).toHaveText('Untitled Screenplay');
    await lineWith(page, 'Untitled').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Two');
    await expect(page.locator('.doc-name')).toHaveText('Untitled Two');
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

    await fromMenu(page, 'home');
    const row = page.locator('.recent-row', { hasText: 'Typed before reload.' });
    await expect(row).toContainText('unsaved changes');
    await row.locator('.recent-open').click();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toContain('Typed before reload.');
  });

  test('leaving right after typing keeps the text', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('Quick exit.');
    await fromMenu(page, 'home');
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
    await fromMenu(page, 'home');
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
    await fromMenu(page, 'save');
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
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-name')).toHaveText('elsewhere.fountain');
    expect(await page.evaluate(() => window.readFile('elsewhere.fountain'))).toContain('From disk');

    // The next save starts from the new file.
    await fromMenu(page, 'save');
    await expect.poll(async () => (await page.evaluate(() => window.pickerCalls)).at(-1).startInName).toBe('elsewhere.fountain');
  });

  test('cancelling the OS dialog changes nothing', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('Z');
    await page.evaluate(() => { window.pickerCancels = true; });
    await fromMenu(page, 'save');
    await expect.poll(async () => (await page.evaluate(() => window.pickerCalls)).filter((c) => c.kind === 'save').length).toBe(1);
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await expect(page.locator('#toast')).toBeHidden();
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).not.toContain('Z');
  });

  test('save as also goes straight to the OS dialog', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await fromMenu(page, 'save-as');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const save = (await page.evaluate(() => window.pickerCalls)).find((c) => c.kind === 'save');
    expect(save).toEqual({ kind: 'save', suggestedName: 'existing.fountain', startInName: 'existing.fountain' });
  });

  test('a first save asks where, and suggests a name from the title', async ({ page }) => {
    await newScript(page);
    await fromMenu(page, 'save');
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
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const save = (await page.evaluate(() => window.pickerCalls)).find((c) => c.kind === 'save');
    expect(save.suggestedName).toBe('The Long - Way Home!.fountain');
  });

  test('a script with no file to return to asks where instead of downloading', async ({ page }) => {
    await newScript(page);
    await fromMenu(page, 'home');
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
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect((await page.evaluate(() => window.pickerCalls)).filter((c) => c.kind === 'save')).toHaveLength(1);
  });

  test('a file reopened from the recent list still saves back to it', async ({ page }) => {
    await page.goto(HOME);
    await providerCard(page, 'local').click();
    await expect(editor(page)).toBeVisible();
    await page.reload();
    await fromMenu(page, 'home');
    await page.locator('.recent-open').first().click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From disk').click();
    await page.keyboard.type('Y');
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toContain('Y');
  });

  test('a new script goes straight to the OS dialog, then keeps saving there', async ({ page }) => {
    await newScript(page);
    await fromMenu(page, 'save');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('.doc-name')).toHaveText('Untitled Screenplay.fountain');
    expect(await page.evaluate(() => window.readFile('Untitled Screenplay.fountain'))).toContain('Title: Untitled\n');

    await editorFocused(page);
    await page.keyboard.type('More.');
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await fromMenu(page, 'save');
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

    // The state reads Unsaved changes before saving too, so wait until the question was answered.
    const answer = (reply) => new Promise((resolve) => {
      page.once('dialog', async (d) => {
        await d[reply]();
        resolve();
      });
    });
    let answered = answer('dismiss');
    await fromMenu(page, 'save');
    await answered;
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    expect(await page.evaluate(() => window.readFile('existing.fountain'))).toBe('Changed elsewhere.');

    answered = answer('accept');
    await fromMenu(page, 'save');
    await answered;
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
  await fromMenu(page, 'save');
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
    await fromMenu(page, 'save');
    const file = await download;
    expect(file.suggestedFilename()).toBe('phone.fountain');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('#toast')).toContainText('Downloaded');
  });
});

test.describe('files opened from the system', () => {
  // The operating system hands files over through launchQueue, which a test can't trigger, so
  // this stands in for it. The handles and everything after them are real.
  const fakeLaunchQueue = () => {
    Object.defineProperty(window, 'launchQueue', {
      value: { setConsumer(consumer) { window.launchFiles = (handles) => consumer({ files: handles }); } },
    });
    window.launchFile = async (name, text) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      await window.launchFiles([handle]);
    };
  };
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(fakePickers);
    await page.addInitScript(fakeLaunchQueue);
  });

  test('a launched file opens in the editor and saves straight back to it', async ({ page }) => {
    await page.goto(HOME);
    await page.evaluate(() => window.launchFile('launched.fountain', 'INT. DOCK - NIGHT\r\n\r\nWaves.'));
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('.doc-name')).toHaveText('launched.fountain');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await value(page)).toBe('INT. DOCK - NIGHT\n\nWaves.');

    await lineWith(page, 'Waves').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More.');
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('launched.fountain'))).toContain('Waves. More.');
  });

  test('opening the same file again reuses its script, refreshed unless it has unsaved work', async ({ page }) => {
    await page.goto(HOME);
    await page.evaluate(() => window.launchFile('again.fountain', 'First.'));
    await expect(editor(page)).toBeVisible();
    const firstUrl = page.url();

    await page.evaluate(() => window.launchFile('again.fountain', 'Changed on disk.'));
    await expect.poll(() => value(page)).toBe('Changed on disk.');
    expect(page.url()).toBe(firstUrl);

    await lineWith(page, 'Changed on disk').click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    await page.evaluate(() => window.launchFile('again.fountain', 'Disk again.'));
    await expect.poll(() => value(page)).toBe('Changed on disk.!');

    await fromMenu(page, 'home');
    await expect(page.locator('.recent-name', { hasText: 'again.fountain' })).toHaveCount(1);
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
    // Installed on a desktop, it opens Fountain files from the file manager, in the open window.
    expect(manifest.file_handlers).toEqual([{ action: './', accept: { 'text/plain': ['.fountain', '.spmd'] } }]);
    expect(manifest.launch_handler).toEqual({ client_mode: 'focus-existing' });
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

const MODES = ['Auto', 'Light', 'Dark'];
const themeOption = (scope, name) => scope.getByRole(MODES.includes(name) ? 'tab' : 'radio', { name, exact: true });

// Chooses a palette or a mode on the Document menu's Theme card, then closes the menu.
async function chooseTheme(page, name) {
  await fromMenu(page, 'theme');
  await themeOption(docMenu(page), name).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(docMenu(page)).toHaveCount(0);
}

test('theme choice applies to the app and script, and persists', async ({ page }) => {
  await newScript(page);
  await chooseTheme(page, 'Sea');
  await chooseTheme(page, 'Dark');
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'sea-dark');
  await expect(docPill(page)).toHaveCSS('color', 'rgb(225, 229, 242)');
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('flow-script')).toHaveAttribute('theme', 'sea-dark');
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sea-dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 28, 30)');
  // App settings shows the same choice.
  await page.locator('#app-settings').click();
  const settings = page.locator('dialog.fl-settings-dialog');
  await expect(themeOption(settings, 'Sea')).toHaveAttribute('aria-checked', 'true');
  await expect(themeOption(settings, 'Sage')).toHaveAttribute('aria-checked', 'false');
  await expect(themeOption(settings, 'Dark')).toHaveAttribute('aria-selected', 'true');
});

test('every theme can be chosen from the Theme card and fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await newScript(page);
  for (const [name, theme] of [['Sage', 'sage'], ['Sand', 'sand'], ['Sea', 'sea'], ['Romance', 'romance'], ['Forest', 'forest'], ['Lavender', 'lavender'], ['Graphite', 'graphite']]) {
    await fromMenu(page, 'theme');
    const option = themeOption(docMenu(page), name);
    await option.scrollIntoViewIfNeeded();
    await expect(option).toBeInViewport();
    await option.click();
    await expect(page.locator('flow-script')).toHaveAttribute('theme', `${theme}-auto`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
});

test('the Theme card swaps in for the menu, with Light and Dark as tabs like Write, Outline and Read', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await newScript(page);
  await fromMenu(page, 'theme');
  const card = docMenu(page).locator('.fl-docmenu-panel');
  await expect(card.getByRole('heading', { name: 'Theme' })).toBeVisible();
  // It takes the main card's place rather than stacking on it.
  await expect(docMenu(page).locator('.fl-docmenu-main')).toBeHidden();
  const modes = card.getByRole('tablist', { name: 'Mode' });
  await expect(modes).toHaveClass(/fl-tabs/);
  await expect(card.getByRole('tab')).toHaveText(MODES);
  await expect(card.getByRole('tab', { name: 'Auto' })).toHaveCSS('background-color', 'rgb(82, 121, 111)');
  await card.getByRole('button', { name: 'Back' }).click();
  await expect(card).toHaveCount(0);
  await expect(docMenu(page).getByRole('menuitem', { name: 'Theme' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The palettes wrap in a grid in App settings too.
  await fromMenu(page, 'app-settings');
  const swatches = page.locator('dialog.fl-settings-dialog .fl-theme-swatch');
  const first = await swatches.nth(0).boundingBox();
  const second = await swatches.nth(1).boundingBox();
  expect(second.y).toBeCloseTo(first.y, 0);
  expect(second.x).toBeGreaterThan(first.x + first.width - 1);
});

test('App settings shows each section as its own page, and searches all of them', async ({ page }) => {
  await page.goto(HOME);
  await page.locator('#app-settings').click();
  const dialog = page.locator('dialog.fl-settings-dialog');
  await expect(dialog.getByRole('heading', { name: 'App Settings' })).toBeVisible();
  const appearance = dialog.getByRole('heading', { name: 'Appearance' });
  const app = dialog.getByRole('heading', { name: 'App', exact: true });
  await expect(appearance).toBeVisible();
  await expect(app).toBeHidden();

  // The search sits inside the panel.
  const search = dialog.getByRole('searchbox', { name: 'Search settings' });
  const panel = await dialog.boundingBox();
  const field = await search.boundingBox();
  expect(field.y).toBeGreaterThan(panel.y);
  expect(field.x).toBeGreaterThan(panel.x);

  await dialog.getByRole('button', { name: 'App', exact: true }).click();
  await expect(app).toBeVisible();
  await expect(appearance).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'App', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await search.fill('dark');
  await expect(appearance).toBeVisible();
  await expect(app).toBeHidden();
  await search.fill('install');
  await expect(app).toBeVisible();
  await expect(appearance).toBeHidden();
  await search.fill('');
  await expect(app).toBeVisible();

  // Rules only come between topics, not after the last.
  const last = dialog.locator('.fl-settings-section:not([hidden]) .fl-settings-topic').last();
  await expect(last).toHaveCSS('border-bottom-width', '0px');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Defaults set the size and cover fields that new scripts start with', async ({ page }) => {
  await page.goto(HOME);
  await page.locator('#app-settings').click();
  const dialog = page.locator('dialog.fl-settings-dialog');
  await dialog.getByRole('button', { name: 'Defaults', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Author' }).fill('Ada Writer');
  // A field is switched off rather than removed, and keeps its text for later.
  await dialog.getByRole('checkbox', { name: 'Include Source' }).uncheck();
  await expect(dialog.getByRole('textbox', { name: 'Source' })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: 'Source' })).toHaveValue('Based On Blank');
  await expect(dialog.getByRole('textbox', { name: 'New field name' })).toHaveCount(0);
  await dialog.getByLabel('Size').selectOption('a4');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.locator('#new-script').click();
  await expect(editor(page)).toBeVisible();
  const text = await value(page);
  expect(text).toContain('Author: Ada Writer');
  expect(text).not.toContain('Source:');
  expect(text).toContain('Credit: Written by');
  expect(text).toContain('Dimensions: A4');
  expect(text.startsWith('Title: Untitled\n')).toBe(true);

  // They're kept for next time.
  await page.goto(HOME);
  await page.locator('#app-settings').click();
  await dialog.getByRole('button', { name: 'Defaults', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Author' })).toHaveValue('Ada Writer');
  await expect(dialog.getByRole('checkbox', { name: 'Include Source' })).not.toBeChecked();
  await expect(dialog.getByLabel('Size')).toHaveValue('a4');
});

test('a theme saved by an older version still loads', async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate(() => localStorage.setItem('flow-theme', 'auto'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage-auto');
  await page.evaluate(() => localStorage.setItem('flow-theme', 'sage-dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage-dark');
});

test.describe('editor bars', () => {
  test('on one row, everything runs document, tabs, then formatting', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const box = (locator) => locator.boundingBox();
    const doc = await box(docPill(page));
    const tabs = await box(page.getByRole('tablist', { name: 'Workspace' }));
    const format = await box(page.locator('flow-script .fl-ribbon'));
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(format.x);
    expect(format.x + format.width).toBeLessThanOrEqual(1268);
    const middle = doc.y + doc.height / 2;
    for (const other of [tabs, format]) expect(Math.abs(other.y + other.height / 2 - middle)).toBeLessThan(2);
    // Export and settings live in the Document menu now.
    await expect(page.locator('flow-script .fl-export, flow-script .fl-settings')).toHaveCount(0);
  });

  test('a very long title gives way before the row breaks', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await newScript(page);
    await page.keyboard.type('A very long title indeed '.repeat(8));
    await expect(page.locator('.doc-name')).toContainText('A very long');
    const doc = await docPill(page).boundingBox();
    const tabs = await page.getByRole('tablist', { name: 'Workspace' }).boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(1000);
    expect(Math.abs(tabs.y - doc.y)).toBeLessThan(8);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
  });

  test('on two rows, formatting leans left beneath the document and tabs', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await newScript(page);
    const doc = await docPill(page).boundingBox();
    const tabs = await page.getByRole('tablist', { name: 'Workspace' }).boundingBox();
    const bold = await page.locator('flow-script .fl-ribbon').getByRole('button', { name: 'Bold', exact: true }).boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tabs.x);
    expect(bold.y).toBeGreaterThanOrEqual(doc.y + doc.height - 1);
    expect(bold.x).toBeLessThan(25);
  });


  test('every pill in the top rows floats the same way, and all still work', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const shadowOf = (locator) => locator.evaluate((el) => getComputedStyle(el).boxShadow);
    const doc = docPill(page);
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const expected = await shadowOf(page.locator('flow-script .fl-ribbon .fl-pill').first());
    expect(await shadowOf(doc)).toBe(expected);
    expect(await shadowOf(tabs)).toBe(expected);

    await page.locator('flow-script').evaluate((el) => { el.value = 'Beat.\n\n'.repeat(300); });
    await page.locator('flow-script .fl-scroll').evaluate((el) => { el.scrollTop = 900; });
    const box = await doc.boundingBox();
    expect(box.y).toBeLessThan(20);
    await expect(doc).toBeInViewport();
    await fromMenu(page, 'home');
    await expect(page.locator('#new-script')).toBeVisible();
  });

  for (const width of [1280, 900, 390]) {
    test(`the document and tabs pills match in height and padding at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await newScript(page);
      const doc = docPill(page);
      const tabs = width > 600 ? page.getByRole('tablist', { name: 'Workspace' }) : page.locator('.fl-compact-only .fl-tabs');
      const docBox = await doc.boundingBox();
      const tabsBox = await tabs.boundingBox();
      expect(tabsBox.height).toBeCloseTo(docBox.height, 0);
      expect(tabsBox.y).toBeCloseTo(docBox.y, 0);
      const paddings = (locator) => locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.paddingTop, style.paddingBottom];
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
    const accent = 'rgb(82, 121, 111)';
    const doc = docPill(page);
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const docBox = await doc.boundingBox();
    const tabsBox = await tabs.boundingBox();

    // Side by side at the left, with a gap between, even with room left over.
    expect(tabsBox.x).toBeGreaterThan(docBox.x + docBox.width);
    expect(tabsBox.x - (docBox.x + docBox.width)).toBeLessThan(12);
    expect(tabsBox.x + tabsBox.width).toBeLessThan(520);

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

    // Read is a tab like the others, so the tabs stay.
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.getByRole('tab', { name: 'Read' }).click();
    await expect(tabs).toBeVisible();
    await expect(doc).toBeVisible();
  });

  test('the document pill shows title, date and source, and its menu leads home', async ({ page }) => {
    await newScript(page);
    await expect(page.locator('.doc-date')).toHaveText(new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
    await expect(page.locator('.doc-state')).toBeVisible();
    // The app's name and details sit inside the menu's pill.
    const pill = await docPill(page).boundingBox();
    const name = await page.locator('.doc-name').boundingBox();
    expect(name.x).toBeGreaterThan(pill.x);
    expect(name.x + name.width).toBeLessThanOrEqual(pill.x + pill.width);
    await docPill(page).click();
    const items = docMenu(page).getByRole('menuitem');
    await expect(items).toHaveCount(7);
    for (const [i, name] of ['Home', 'Save', 'Save as', 'Export to PDF', 'Theme', 'Project settings', 'App settings'].entries()) {
      await expect(items.nth(i)).toHaveAccessibleName(name);
    }
    await expect(docMenu(page).locator('#save')).toContainText('Ctrl+S');
    await docMenu(page).locator('#home').click();
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

  test('showing a card in Read from the outline moves the tabs and the address along', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await page.locator('flow-script').evaluate((el) => { el.value = 'INT. A - DAY\n\nAction.\n\nINT. B - DAY\n\nMore.'; });
    await page.getByRole('tab', { name: 'Outline' }).click();
    await page.locator('flow-script .fl-outline-block-text', { hasText: 'INT. B - DAY' }).click({ button: 'right' });
    await page.locator('flow-script .fl-outline-menu').getByRole('menuitem', { name: 'Show in Read' }).click();
    await expect(page.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'false');
    expect(page.url()).toMatch(/\?tab=read$/);
    // Choosing Outline again works, now that the tabs know Read is showing.
    await page.getByRole('tab', { name: 'Outline' }).click();
    await expect(page.locator('flow-script .fl-outline')).toBeVisible();
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

  test('Write comes first and Read last, and the address remembers the tab through a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    await expect(page.getByRole('tab')).toHaveText(['Write', 'Outline', 'Read']);
    expect(page.url()).not.toContain('tab=');

    await page.getByRole('tab', { name: 'Outline' }).click();
    expect(page.url()).toMatch(/#\/edit\/[^?]+\?tab=outline$/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Add act', exact: true })).toBeVisible();
    await expect(page.locator('flow-script .ProseMirror')).toBeHidden();

    await page.getByRole('tab', { name: 'Read' }).click();
    expect(page.url()).toMatch(/#\/edit\/[^?]+\?tab=read$/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('flow-script .fl-read')).toBeVisible();

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

  test('Read swaps the action center for its own and hides the Write view and history, and only those', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await newScript(page);
    const bar = page.locator('flow-script .fl-statusbar');
    const ribbon = page.locator('flow-script .fl-ribbon');
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const tabsBefore = await tabs.boundingBox();

    await page.getByRole('tab', { name: 'Read' }).click();
    await expect(ribbon.getByRole('button', { name: 'Bold', exact: true })).toBeHidden();
    await expect(ribbon.getByRole('button', { name: 'Highlight Manager' })).toBeVisible();
    await expect(tabs).toBeVisible();
    // Read has its own view menu, in place of Write's.
    await expect(bar.getByRole('button', { name: 'View: Seamless' })).toBeHidden();
    await expect(bar.getByRole('button', { name: 'View: Paged' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeHidden();
    await expect(docPill(page)).toBeVisible();
    await expect(bar).toBeVisible();
    // Nothing else in the top row moves.
    expect((await tabs.boundingBox()).x).toBeCloseTo(tabsBefore.x, 0);

    await page.setViewportSize({ width: 390, height: 700 });
    await expect(page.getByRole('button', { name: 'Workspace: Read' })).toBeVisible();
    await expect(docPill(page)).toBeInViewport({ ratio: 1 });

    await page.setViewportSize({ width: 1280, height: 700 });
    await page.getByRole('tab', { name: 'Write' }).click();
    await expect(ribbon).toBeVisible();
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  });

  test('wide text is remembered between scripts', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await newScript(page);
    await page.locator('flow-script .fl-statusbar').getByRole('switch', { name: 'Wide page' }).click();
    await expect(page.locator('flow-script')).toHaveAttribute('text-width', 'wide');
    await newScript(page);
    await expect(page.locator('flow-script')).toHaveAttribute('text-width', 'wide');
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
      const name = await docPill(page).boundingBox();
      expect(name.x + name.width).toBeLessThanOrEqual(width);
    });
  }


  test('a small screen fits the document and tab menus on one row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await newScript(page);
    const doc = await docPill(page).boundingBox();
    const tabMenu = page.getByRole('button', { name: 'Workspace: Write' });
    const tab = await tabMenu.boundingBox();
    expect(doc.x + doc.width).toBeLessThanOrEqual(tab.x);
    expect(tab.x + tab.width).toBeLessThanOrEqual(390);
    expect(Math.abs((doc.y + doc.height / 2) - (tab.y + tab.height / 2))).toBeLessThan(2);
    await expect(page.locator('.fl-wide-only .fl-tab').first()).toBeHidden();

    await tabMenu.click();
    await expect(page.getByRole('menuitemradio', { name: 'Write' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: 'Outline' }).click();
    await expect(page.getByRole('button', { name: 'Workspace: Outline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add act', exact: true })).toBeVisible();

  });

  test('saving works from the Document menu on a small screen', async ({ page }) => {
    await page.addInitScript(fakePickers);
    await page.setViewportSize({ width: 390, height: 700 });
    await newScript(page);
    await fromMenu(page, 'save');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
  });
});
