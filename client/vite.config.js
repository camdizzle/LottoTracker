import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output is written to the repo root so index.html and assets/ sit at
// the top level — required by the deploy target. `emptyOutDir: false` keeps
// Vite from trying to wipe the repo root; a pre-build script cleans only the
// previous build artifacts (see scripts/clean-build.js).
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
  server: {
    port: 5280,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
