import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      entry: 'src/docs-ui.js',
      name: 'DocsUI',
      formats: ['iife'],
      fileName: () => 'docs-ui.js',
    },
    outDir: 'dist',
    // CSS is inlined in the JS bundle via ?inline import — no separate file.
    cssCodeSplit: false,
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
