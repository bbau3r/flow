import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // Relative paths let one build work at the root of a domain or under /flow/ on GitHub Pages.
  base: './',
  // Tests get their own build with no credentials, whatever is in a developer's .env.local.
  envDir: mode === 'e2e' ? 'e2e' : '.',
  build: { target: 'es2022', outDir: mode === 'e2e' ? 'dist-e2e' : 'dist' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // Everything is precached, including the editor, PDF and font chunks, so the
        // whole app works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        id: './',
        name: 'Flow',
        short_name: 'Flow',
        description: 'Write Fountain screenplays, online or off.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#efe4cb',
        theme_color: '#b45309',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}));
