import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages/element/e2e',
  timeout: 30000,
  use: { channel: 'msedge', baseURL: 'http://localhost:4178', acceptDownloads: true },
  webServer: {
    command: 'npx vite --port 4178 --strictPort',
    cwd: 'packages/element',
    url: 'http://localhost:4178/demo/index.html',
    reuseExistingServer: true,
  },
});
