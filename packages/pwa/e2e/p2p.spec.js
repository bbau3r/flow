import { test, expect } from '@playwright/test';

// P2P runs between two browsers here, a host and a guest, each a context of its own, meeting
// through the local PeerJS server that peer-server.mjs runs.

const HOME = '/flow/';
const ROUTE = 'localhost:4180';
const editor = (page) => page.locator('flow-script .ProseMirror');
const value = (page) => page.locator('flow-script').evaluate((el) => el.value);
const trigger = (page) => page.locator('flow-script [data-p2p="trigger"]');
const card = (page) => page.locator('[data-p2p="card"]');
// Puts the cursor at the end of the script, past the title page.
const toEnd = (page) => page.locator('flow-script').evaluate((el) => {
  const lines = el.value.split('\n');
  el.selectText(lines.length - 1, lines.at(-1).length, lines.at(-1).length);
});
const editorFocused = (page) => expect(page.locator('flow-script .fl-active').first()).toBeAttached();

// Headless browsers hide local addresses behind mDNS names, which two contexts on one machine
// can't always resolve, so this lets them see each other's.
test.use({ launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } });

// A browser with P2P on and the local route, under an alias of its own.
async function person(browser, alias, { enabled = true } = {}) {
  const context = await browser.newContext();
  await context.addInitScript(({ alias, enabled, route }) => {
    if (enabled) localStorage.setItem('flow-p2p', 'on');
    localStorage.setItem('flow-p2p-route', route);
    localStorage.setItem('flow-p2p-alias', alias);
  }, { alias, enabled, route: ROUTE });
  const page = await context.newPage();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  return page;
}

async function newScript(page) {
  await page.goto(HOME);
  await page.locator('#new-script').click();
  await expect(editor(page)).toBeVisible();
  await editorFocused(page);
}

// Hosts the open script under a server name of its own, and returns the name and token.
async function host(page) {
  const server = `test-${Math.random().toString(36).slice(2, 8)}`;
  await trigger(page).click();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await card(page).locator('[data-p2p="routing"] summary').click();
  await card(page).locator('[data-p2p="server"]').fill(server);
  const token = await card(page).locator('[data-p2p="token"]').inputValue();
  await card(page).locator('[data-p2p="host"]').click();
  await expect(card(page).locator('.p2p-status')).toHaveText('Hosting', { timeout: 15000 });
  // While hosting, what the session was started with stays as it is.
  await card(page).locator('[data-p2p="routing"] summary').click();
  for (const field of ['server', 'token', 'alias']) await expect(card(page).locator(`[data-p2p="${field}"]`)).not.toBeEditable();
  return { server, token };
}

async function join(page, { server, token }) {
  await page.goto(HOME);
  await page.locator('#connect-script').click();
  const dialog = page.locator('[data-p2p="connect-dialog"]');
  await dialog.locator('[data-p2p="server"]').fill(server);
  await dialog.locator('[data-p2p="token"]').fill(token);
  await dialog.locator('[data-p2p="connect"]').click();
  return dialog;
}

test.describe('P2P', () => {
  test('stays hidden until it is turned on in App settings', async ({ browser }) => {
    const page = await person(browser, 'Kyle', { enabled: false });
    await page.goto(HOME);
    await expect(page.locator('#open-script')).toBeVisible();
    await expect(page.locator('#connect-script')).toHaveCount(0);

    await page.locator('#app-settings').click();
    await page.locator('.fl-settings-rail').getByRole('button', { name: 'App', exact: true }).click();
    await page.locator('#p2p-enabled').check();
    await page.keyboard.press('Escape');
    await expect(page.locator('#connect-script')).toBeVisible();

    await page.locator('#new-script').click();
    await expect(trigger(page)).toBeVisible();
  });

  test('a host and a guest write in one script, each undoing only their own edits', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    const ana = await person(browser, 'Ana');
    await newScript(kyle);
    await kyle.locator('flow-script').evaluate((el) => { el.value = 'Title: Tea\n\nINT. KITCHEN - DAY\n\nKyle was here.'; });
    const session = await host(kyle);
    await kyle.keyboard.press('Escape');

    await join(ana, session);
    await expect(editor(ana)).toBeVisible({ timeout: 15000 });
    await expect.poll(() => value(ana)).toContain('Kyle was here.');

    // Both see both of them, stacked in the corner.
    await expect(trigger(kyle).locator('.p2p-avatar')).toHaveCount(2);
    await expect(trigger(ana).locator('.p2p-avatar')).toHaveCount(2);

    // The guest's edit reaches the host.
    await toEnd(ana);
    await editorFocused(ana);
    await ana.keyboard.type(' Ana too.');
    await expect.poll(() => value(kyle)).toContain('Kyle was here. Ana too.');

    // The host's edit reaches the guest, while the guest's stays.
    await toEnd(kyle);
    await editorFocused(kyle);
    await kyle.keyboard.type('\n\nThe kettle boils.');
    await expect.poll(() => value(ana)).toContain('Ana too.\n\nThe kettle boils.');

    // Undo takes back only what the guest wrote, and everyone sees it.
    await editor(ana).click();
    await ana.keyboard.press('Control+z');
    await expect.poll(() => value(ana)).not.toContain('Ana too.');
    expect(await value(ana)).toContain('The kettle boils.');
    await expect.poll(() => value(kyle)).not.toContain('Ana too.');
    expect(await value(kyle)).toContain('The kettle boils.');

    // Each change is listed with who made it.
    await trigger(kyle).click();
    await expect(card(kyle).locator('.p2p-change', { hasText: 'Ana' }).first()).toBeVisible();
    await expect(card(kyle).locator('.p2p-change', { hasText: 'near INT. KITCHEN - DAY' }).first()).toBeVisible();
  });

  test('the host can remove a guest', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    const ana = await person(browser, 'Ana');
    await newScript(kyle);
    const session = await host(kyle);
    await kyle.keyboard.press('Escape');
    await join(ana, session);
    await expect(editor(ana)).toBeVisible({ timeout: 15000 });

    await trigger(kyle).click();
    await card(kyle).locator('.p2p-member', { hasText: 'Ana' }).click();
    await expect(card(kyle)).toContainText('Connected');
    await card(kyle).locator('[data-p2p="kick"]').click();
    await expect(card(kyle).locator('.p2p-member')).toHaveCount(1);

    // Your own card has no Kick, and nothing in its place.
    await card(kyle).locator('.p2p-member', { hasText: 'You' }).click();
    await expect(card(kyle).locator('[data-p2p="kick"]')).toHaveCount(0);
    await expect(card(kyle)).not.toContainText('null');
    await card(kyle).locator('[data-p2p="back"]').click();
    await expect(card(kyle).locator('.p2p-member')).toHaveCount(1);

    await expect(ana.locator('#toast')).toHaveText('The host removed you from the session.');
    await expect(trigger(ana).locator('.p2p-avatar')).toHaveCount(0);
  });

  test('a wrong token shows an error that can be dismissed', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    const ana = await person(browser, 'Ana');
    await newScript(kyle);
    const session = await host(kyle);

    const dialog = await join(ana, { ...session, token: 'WRNG-TOKN-HERE' });
    const error = dialog.locator('.fl-banner-danger');
    await expect(error).toContainText('token doesn’t match', { timeout: 15000 });
    await expect(dialog.locator('[data-p2p="connect"]')).toBeEnabled();
    await error.locator('.fl-banner-close').click();
    await expect(error).toBeHidden();
  });

  test('says when no one is hosting under a name', async ({ browser }) => {
    const ana = await person(browser, 'Ana');
    const dialog = await join(ana, { server: 'nobody-here-123', token: 'ABCD-EFGH-JKMN' });
    await expect(dialog.locator('.fl-banner-danger')).toContainText('No one is hosting', { timeout: 15000 });
  });

  test('on a phone the corner folds behind ⋮', async ({ browser }) => {
    const page = await person(browser, 'Kyle');
    await page.setViewportSize({ width: 390, height: 800 });
    await newScript(page);
    await expect(trigger(page)).toBeHidden();
    await page.locator('flow-script .fl-topbar-more button').click();
    await trigger(page).click();
    await expect(card(page)).toBeVisible();
    await expect(page.locator('.fl-popover')).toHaveAttribute('data-mode', 'sheet');
  });
});

test.describe('P2P invites', () => {
  // Puts text on a browser's clipboard and pastes it into the Connect dialog's first field.
  async function pasteInvite(page, text) {
    await page.goto(HOME);
    await page.locator('#connect-script').click();
    const dialog = page.locator('[data-p2p="connect-dialog"]');
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
    await dialog.locator('[data-p2p="server"]').focus();
    await page.keyboard.press('Control+v');
    return dialog;
  }

  test('a copied invite fills in Connect, and joins', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    const ana = await person(browser, 'Ana');
    await newScript(kyle);
    const session = await host(kyle);
    await card(kyle).locator('[data-p2p="copy-invite"]').click();
    const invite = await kyle.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(invite)).toMatchObject({ server: session.server, token: session.token, route: ROUTE });

    const dialog = await pasteInvite(ana, invite);
    await expect(dialog.locator('[data-p2p="server"]')).toHaveValue(session.server);
    await expect(dialog.locator('[data-p2p="token"]')).toHaveValue(session.token);
    await expect(dialog.locator('[data-p2p="route"]')).toHaveValue(ROUTE);
    await expect(dialog).toContainText('Filled in from the invite');
    await dialog.locator('[data-p2p="connect"]').click();
    await expect(editor(ana)).toBeVisible({ timeout: 15000 });
  });

  test('turns down an invite that was changed', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    await newScript(kyle);
    await trigger(kyle).click();
    await card(kyle).locator('[data-p2p="copy-invite"]').click();
    const invite = JSON.parse(await kyle.evaluate(() => navigator.clipboard.readText()));

    const dialog = await pasteInvite(kyle, JSON.stringify({ ...invite, server: 'someone-else' }));
    await expect(dialog.locator('.fl-banner-danger')).toContainText('changed or cut short');
    await expect(dialog.locator('[data-p2p="server"]')).toHaveValue('');
  });

  test('says which signal server it uses', async ({ browser }) => {
    const kyle = await person(browser, 'Kyle');
    await newScript(kyle);
    await trigger(kyle).click();
    // Alias comes first; the server name and token are folded away, ahead of Copy invite.
    const order = await card(kyle).locator(':scope > *').evaluateAll((nodes) => nodes.map((n) => n.dataset.p2p ?? n.querySelector('[data-p2p]')?.dataset.p2p ?? n.className));
    expect(order.filter((name) => ['alias', 'routing', 'copy-invite', 'host'].includes(name))).toEqual(['alias', 'routing', 'copy-invite', 'host']);
    await expect(card(kyle).locator('[data-p2p="server"]')).toBeHidden();
    await card(kyle).locator('[data-p2p="routing"] summary').click();
    await expect(card(kyle).locator('.p2p-note')).toHaveText(`Using ${ROUTE} server.`);
  });
});
