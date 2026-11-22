import { test, expect } from '@playwright/test';

// Test browsers hide scrollbars by default, but real ones take up room that floating
// menus have to stay out of.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function longScript(page) {
  await page.goto('/flow/');
  await page.locator('#new-script').click();
  await expect(page.locator('flow-script .ProseMirror')).toBeVisible();
  await page.locator('flow-script').evaluate((el) => {
    const style = document.createElement('style');
    style.textContent = '.fl-scroll::-webkit-scrollbar { width: 20px; height: 20px; }';
    el.shadowRoot.append(style);
    el.value = 'Beat.\n\n'.repeat(300);
  });
  const area = page.locator('flow-script .fl-scroll');
  await expect.poll(() => area.evaluate((el) => el.offsetWidth - el.clientWidth)).toBe(20);
  return area;
}

for (const view of ['Paged', 'Read', 'Seamless', 'Fountain']) {
  test(`${view} never scrolls sideways at any window width`, async ({ page }) => {
    const area = await longScript(page);
    if (view === 'Read') {
      await page.getByRole('tab', { name: 'Read' }).click();
    } else {
      const bar = page.locator('flow-script .fl-statusbar');
      await bar.locator('.fl-menu-trigger:visible').click();
      await bar.getByRole('menuitemradio', { name: view, exact: true }).click();
    }
    for (const width of [1280, 900, 700, 600, 500, 420, 390, 320]) {
      await page.setViewportSize({ width, height: 700 });
      await expect.poll(() => area.evaluate((el) => el.scrollWidth - el.clientWidth), `at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('zooming a page past the window does scroll sideways, on purpose', async ({ page }) => {
  const area = await longScript(page);
  await page.setViewportSize({ width: 600, height: 700 });
  await page.locator('flow-script').evaluate((el) => { el.view = 'page'; el.scale = 200; });
  await expect.poll(() => area.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(100);
});

const menus = {
  view: (page) => page.locator('flow-script .fl-statusbar .fl-menu').first(),
  topics: (page) => page.locator('flow-script .fl-topics'),
};

for (const [name, menu] of Object.entries(menus)) {
  test(`the ${name} menu stays inside the script area without scrolling it sideways`, async ({ page }) => {
    const area = await longScript(page);
    for (const width of [1280, 900, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 700 });
      await menu(page).locator('.fl-menu-trigger').click();
      const popup = menu(page).locator('.fl-menu-popup');
      await expect(popup).toBeVisible();
      const measured = await area.evaluate((el) => ({
        sideways: el.scrollWidth - el.clientWidth,
        right: el.getBoundingClientRect().left + el.clientWidth,
      }));
      const box = await popup.boundingBox();
      expect(measured.sideways, `sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
      expect(box.x + box.width, `right edge at ${width}px`).toBeLessThanOrEqual(measured.right);
      expect(box.x, `left edge at ${width}px`).toBeGreaterThanOrEqual(0);
      await menu(page).locator('.fl-menu-trigger').click();
    }
  });
}

test('the Document menu stays on screen without scrolling anything sideways', async ({ page }) => {
  await longScript(page);
  for (const width of [1280, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.locator('flow-script .fl-docmenu-trigger').click();
    const card = page.locator('flow-script .fl-docmenu-main');
    await expect(card).toBeVisible();
    await page.waitForTimeout(250);
    const box = await card.boundingBox();
    expect(box.x, `left edge at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `right edge at ${width}px`).toBeLessThanOrEqual(width);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
  }
});
