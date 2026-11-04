import { defineConfig } from '@playwright/test';

// Locally this uses the installed Edge. CI installs Playwright's own Chromium.
const channel = process.env.CI ? undefined : 'msedge';

export default defineConfig({
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI, failures also appear as annotations on the run, readable without opening logs.
  reporter: process.env.CI ? [['github'], ['line']] : 'list',
  use: { channel, acceptDownloads: true },
  projects: [
    {
      name: 'element',
      testDir: 'packages/element/e2e',
      use: { baseURL: 'http://localhost:4178' },
    },
    {
      name: 'pwa',
      testDir: 'packages/pwa/e2e',
      use: { baseURL: 'http://localhost:4180' },
    },
  ],
  webServer: [
    {
      command: 'npx vite --port 4178 --strictPort',
      cwd: 'packages/element',
      url: 'http://localhost:4178/demo/index.html',
      reuseExistingServer: true,
    },
    {
      command: 'node packages/pwa/e2e/serve.mjs dist-e2e 4180',
      url: 'http://localhost:4180/flow/',
      reuseExistingServer: true,
    },
  ],
});
