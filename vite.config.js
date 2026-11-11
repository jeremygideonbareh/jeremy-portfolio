import { defineConfig } from 'vite';

// Relative base so the same build works at a domain root or a GitHub Pages
// project path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 900, // three.js lives in its own lazily-loaded chunk
  },
});
