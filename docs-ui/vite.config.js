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
    rollupOptions: {
      output: {
        assetFileNames: 'docs-ui.[ext]',
      },
    },
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
