import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// The dashboard builds to static assets the gateway serves as-is (no SSR), so the single
// self-hostable container is unchanged. `base: './'` keeps asset URLs relative, so it works
// whether mounted at the site root or a sub-path.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // CSS Modules are not needed for behaviour tests (queries use roles/text), and skipping
    // their transform keeps the suite fast.
    css: false,
  },
});
