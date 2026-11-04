import { test, expect } from '@playwright/test';

// These exercise the built output, so run them through `npm run test:e2e`, which builds first.
const SCRIPT = 'Title: Built\n\nINT. ROOM - DAY\n\nHello [[a note]] there.\n';

async function mount(page, file, attrs = '') {
  await page.goto('/e2e/blank.html');
  await page.evaluate(([attrs, script]) => {
    document.body.innerHTML = `<flow-script ${attrs}></flow-script>`;
    document.querySelector('flow-script').value = script;
  }, [attrs, SCRIPT]);
  await page.addScriptTag({ type: 'module', url: `/dist/${file}` });
}

test('single-file bundle edits and exports with no further requests or network', async ({ page, context }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await mount(page, 'flow-script.bundle.js');
  await expect(page.locator('flow-script .ProseMirror')).toBeVisible();
  const fromDist = requests.map((u) => new URL(u).pathname).filter((p) => p.startsWith('/dist/'));
  expect(fromDist).toEqual(['/dist/flow-script.bundle.js']);

  await context.setOffline(true);
  await page.locator('flow-script .fl-line', { hasText: 'Hello' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Offline.');
  const result = await page.locator('flow-script').evaluate(async (el) => {
    const pdf = await el.exportPdf();
    return { value: el.value, pages: pdf.pageCount, size: pdf.blob.size };
  });
  expect(result.value).toContain('there. Offline.');
  expect(result.pages).toBe(2);
  expect(result.size).toBeGreaterThan(1000);
});

test('code-split build: read-only stays away from the editor and PDF chunks', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await mount(page, 'flow-script.js', 'readonly');
  await expect(page.locator('flow-script .fl-page').first()).toBeVisible();
  const chunks = requests.filter((u) => u.includes('/dist/')).map((u) => u.split('/').pop());
  expect(chunks.filter((c) => /^(editor|pdf)/.test(c))).toEqual([]);
});

test('code-split build: editing and PDF load their chunks on demand', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await mount(page, 'flow-script.js');
  await expect(page.locator('flow-script .ProseMirror')).toBeVisible();
  expect(requests.some((u) => /\/dist\/editor/.test(u))).toBe(true);
  expect(requests.some((u) => /\/dist\/pdf/.test(u))).toBe(false);
  await page.locator('flow-script').evaluate((el) => el.exportPdf());
  expect(requests.some((u) => /\/dist\/pdf/.test(u))).toBe(true);
});
