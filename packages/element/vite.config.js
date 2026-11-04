import { defineConfig } from 'vite';

// Default build code-splits so read-only pages never download Tiptap or pdf-lib.
// `--mode bundle` produces one self-contained file for dropping into any page.
export default defineConfig(({ mode }) => ({
  server: { open: '/demo/index.html' },
  build: {
    emptyOutDir: mode !== 'bundle',
    target: 'es2022',
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => (mode === 'bundle' ? 'flow-script.bundle.js' : 'flow-script.js'),
    },
    rollupOptions: mode === 'bundle' ? { output: { inlineDynamicImports: true } } : {},
  },
}));
