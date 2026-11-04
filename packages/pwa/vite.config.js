import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths let one build work at the root of a domain or under /flow/ on GitHub Pages.
  base: './',
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // Everything is precached, including the editor, PDF and font chunks, so the
        // whole app works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
});
