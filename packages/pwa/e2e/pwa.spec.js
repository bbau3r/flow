import { test, expect } from '@playwright/test';

const HOME = '/flow/';
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => page.locator('flow-script').evaluate((el) => el.value);
const providerCard = (page, id) => page.locator(`[data-provider="${id}"]`);
const lineWith = (page, text) => page.locator('flow-script .fl-line', { hasText: text }).first();

async function newScript(page) {
  await page.goto(HOME);
  await page.locator('#new-script').click();
  await expect(editor(page)).toBeVisible();
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
  window.showOpenFilePicker = async () => [await write('existing.fountain', 'INT. ROOM - DAY\r\n\r\nFrom disk.')];
  window.showSaveFilePicker = async () => write('picked.fountain', '');
};

test.describe('home page', () => {
  test('offers new, and opening from the device or a drive', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(providerCard(page, 'local')).toBeEnabled();
    await expect(providerCard(page, 'local')).toContainText('This device');
    await expect(providerCard(page, 'google-drive')).toContainText('Google Drive');
    await expect(page.locator('section', { hasText: 'Open a script' }).locator('.card')).toHaveCount(2);
  });

  test('Drive explains itself when it has no credentials', async ({ page }) => {
    await page.goto(HOME);
    await expect(providerCard(page, 'google-drive')).toBeDisabled();
    await expect(providerCard(page, 'google-drive')).toContainText('Needs setup');
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
    await lineWith(page, 'Based on the novel').click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    const edited = await value(page);
    expect(edited).not.toContain('Source:');
    expect(edited).toContain('Author:');
  });

  test('put the cursor below the title page, ready to write', async ({ page }) => {
    await newScript(page);
    await page.keyboard.type('FADE IN:');
    const lines = (await value(page)).split('\n');
    expect(lines.at(-1)).toBe('FADE IN:');
    expect(lines.at(-2)).toBe('');
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
    const row = page.locator('.recent-row', { hasText: 'Untitled Screenplay' });
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

  test('a new script chooses where to go, then keeps saving there', async ({ page }) => {
    await newScript(page);
    await page.locator('#save').click();
    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /This device/ }).click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    await expect(page.locator('.doc-name')).toHaveText('picked.fountain');
    expect(await page.evaluate(() => window.readFile('picked.fountain'))).toContain('Title: Untitled Screenplay');

    await page.keyboard.type('More.');
    await page.locator('#save').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(await page.evaluate(() => window.readFile('picked.fountain'))).toContain('More.');
  });

  test('cancelling the save choice changes nothing', async ({ page }) => {
    await newScript(page);
    await page.locator('#save').click();
    await page.locator('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.doc-state')).toHaveText('On this device only');
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

test.describe('Google Drive', () => {
  // Stands in for Google's sign-in and picker scripts. Drive's REST calls are intercepted
  // below, so everything Flow itself sends and handles is exercised.
  const fakeGoogle = () => {
    globalThis.FLOW_CONFIG = { googleClientId: 'client', googleApiKey: 'key', googleAppId: '123' };
    window.tokensIssued = 0;
    const builder = {
      addView() { return this; },
      setOAuthToken() { return this; },
      setDeveloperKey() { return this; },
      setAppId() { return this; },
      setCallback(cb) { this.cb = cb; return this; },
      build() { return this; },
      setVisible() { setTimeout(() => this.cb(window.pickerResult ?? { action: 'picked', docs: [{ id: 'file-1' }] }), 0); },
    };
    globalThis.google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }) => ({
            requestAccessToken() {
              window.tokensIssued += 1;
              callback({ access_token: `token-${window.tokensIssued}`, expires_in: 3600 });
            },
          }),
        },
      },
      picker: {
        PickerBuilder: function PickerBuilder() { return builder; },
        DocsView: function DocsView() { this.setMode = () => this; },
        ViewId: { DOCS: 'docs' },
        DocsViewMode: { LIST: 'list' },
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
      },
    };
    globalThis.gapi = { load: (_name, cb) => cb() };
  };

  function fakeDrive(page, overrides = {}) {
    const state = { text: 'INT. DRIVE - DAY\n\nFrom Drive.', modifiedTime: 't1', requests: [], ...overrides };
    page.route('https://www.googleapis.com/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      state.requests.push({ method: req.method(), url: req.url(), auth: req.headers().authorization, body: req.postData() });
      if (state.unauthorizedOnce) {
        state.unauthorizedOnce = false;
        await route.fulfill({ status: 401, body: '' });
      } else if (req.method() === 'POST') {
        state.modifiedTime = 't9';
        await route.fulfill({ json: { id: 'new-file', name: 'Untitled Screenplay.fountain', modifiedTime: 't9' } });
      } else if (req.method() === 'PATCH') {
        state.text = req.postData();
        state.modifiedTime = 't2';
        await route.fulfill({ json: { name: 'drive.fountain', modifiedTime: 't2' } });
      } else if (url.searchParams.get('alt') === 'media') {
        await route.fulfill({ body: state.text, contentType: 'text/plain' });
      } else {
        await route.fulfill({ json: { name: 'drive.fountain', modifiedTime: state.modifiedTime } });
      }
    });
    return state;
  }

  test.beforeEach(({ page }) => page.addInitScript(fakeGoogle));

  test('opens a picked file and saves back to it', async ({ page }) => {
    const drive = fakeDrive(page);
    await page.goto(HOME);
    await expect(providerCard(page, 'google-drive')).toBeEnabled();
    await providerCard(page, 'google-drive').click();
    await expect(editor(page)).toBeVisible();
    expect(await value(page)).toBe('INT. DRIVE - DAY\n\nFrom Drive.');
    await expect(page.locator('.doc-name')).toHaveText('drive.fountain');
    expect(drive.requests[0].auth).toBe('Bearer token-1');

    await lineWith(page, 'From Drive').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Edited.');
    await page.keyboard.press('Control+s');
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(drive.text).toBe('INT. DRIVE - DAY\n\nFrom Drive. Edited.');
    const patch = drive.requests.find((r) => r.method === 'PATCH');
    expect(patch.url).toContain('/upload/drive/v3/files/file-1?uploadType=media');
  });

  test('a new script can be created in Drive', async ({ page }) => {
    const drive = fakeDrive(page);
    await newScript(page);
    await page.locator('#save').click();
    await page.locator('dialog').getByRole('button', { name: /Google Drive/ }).click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    const post = drive.requests.find((r) => r.method === 'POST');
    expect(post.url).toContain('uploadType=multipart');
    expect(post.body).toContain('"name":"Untitled Screenplay.fountain"');
    expect(post.body).toContain('Title: Untitled Screenplay');

    await page.keyboard.type('More.');
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Saved');
    expect(drive.requests.find((r) => r.method === 'PATCH').url).toContain('/files/new-file?');
  });

  test('an expired token signs in again and retries', async ({ page }) => {
    const drive = fakeDrive(page, { unauthorizedOnce: true });
    await page.goto(HOME);
    await providerCard(page, 'google-drive').click();
    await expect(editor(page)).toBeVisible();
    expect(await page.evaluate(() => window.tokensIssued)).toBe(2);
    expect(drive.requests[1].auth).toBe('Bearer token-2');
  });

  test('a file changed in Drive is not overwritten without asking', async ({ page }) => {
    const drive = fakeDrive(page);
    await page.goto(HOME);
    await providerCard(page, 'google-drive').click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From Drive').click();
    await page.keyboard.type('X');
    drive.modifiedTime = 'someone-else';
    drive.text = 'Their version.';

    page.once('dialog', (d) => d.dismiss());
    await page.locator('#save').click();
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    expect(drive.text).toBe('Their version.');
  });

  test('a failed save keeps the work and says so', async ({ page }) => {
    fakeDrive(page);
    await page.goto(HOME);
    await providerCard(page, 'google-drive').click();
    await expect(editor(page)).toBeVisible();
    await lineWith(page, 'From Drive').click();
    await page.keyboard.type('X');
    await page.unroute('https://www.googleapis.com/**');
    await page.route('https://www.googleapis.com/**', (route) => route.fulfill({ status: 500, body: '' }));
    await page.locator('#save').click();
    await expect(page.locator('#toast')).toContainText('kept on this device');
    await expect(page.locator('.doc-state')).toHaveText('Unsaved changes');
    expect(await value(page)).toContain('X');
  });

  test('cancelling the picker stays home', async ({ page }) => {
    fakeDrive(page);
    await page.goto(HOME);
    await page.evaluate(() => { window.pickerResult = { action: 'cancel' }; });
    await providerCard(page, 'google-drive').click();
    await expect(page.locator('#new-script')).toBeVisible();
    await expect(page.locator('#toast')).toBeHidden();
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

  test('Drive says it needs internet when offline', async ({ page, context }) => {
    await page.addInitScript(() => {
      globalThis.FLOW_CONFIG = { googleClientId: 'client', googleApiKey: 'key', googleAppId: '123' };
    });
    await page.goto(HOME);
    await expect(providerCard(page, 'google-drive')).toBeEnabled();
    await context.setOffline(true);
    await expect(providerCard(page, 'google-drive')).toContainText('Needs internet');
    await expect(providerCard(page, 'google-drive')).toBeDisabled();
    await context.setOffline(false);
    await expect(providerCard(page, 'google-drive')).toBeEnabled();
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
