import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// The dashboard builds to static assets the gateway serves as-is (no SSR), so the single
// self-hostable container is unchanged. `base: '/'` makes asset URLs absolute (/assets/…): the gateway
// always mounts the dashboard at the site root, and a deep-link refresh (/teams, /nexus …) is answered
// with index.html by the SPA fallback, so assets must resolve from the root regardless of the route
// depth the browser happens to have loaded first — a relative base would break them there.
export default defineConfig({
  base: '/',
  plugins: [preact()],
  // Dev only: the built app is served by the gateway itself, so /admin is same-origin in
  // production. During `vite dev` it runs on its own port, so proxy the admin API to the local
  // gateway (PORT 3000). Never used in the static build.
  server: {
    proxy: {
      '/admin':  { target: 'http://localhost:3000', changeOrigin: true },
      // The LIVE pill polls /health (7.13b). Without this entry vite's SPA fallback answers the
      // probe itself with index.html and a 200, and the pill would glow green in dev with no
      // gateway running at all.
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
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
