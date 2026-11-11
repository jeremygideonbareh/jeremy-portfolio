import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the same build works at a domain root or a GitHub Pages
// project path (https://<user>.github.io/<repo>/).
// Two pages: Track Day (latest) at /, and the original floating island (v1) at /island/.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 900, // three.js lives in its own lazily-loaded chunk
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        island: resolve(import.meta.dirname, 'island/index.html'),
      },
    },
  },
});
