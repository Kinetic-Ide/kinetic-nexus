import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// The dashboard builds to static assets the gateway serves as-is (no SSR), so the single
// self-hostable container is unchanged. `base: '/'` makes asset URLs absolute (/assets/…): the gateway
// always mounts the dashboard at the site root, and a deep-link refresh (/teams, /nexus …) is answered
// with index.html by the SPA fallback, so assets must resolve from the root regardless of the route
// depth the browser happens to have loaded first — a relative base would break them there.
// The static demo (`npm run build:demo`) is the one build that is NOT served from a site root:
// GitHub Pages publishes it under /<repo>/demo/, so both the asset base and the router's mount
// point move. VITE_DEMO doubles as the switch that swaps the API client for the frozen dataset.
// Overridable so a fork with a different repo name — or a custom domain at the root — can build the
// same demo without editing this file.
const DEMO      = process.env.VITE_DEMO === '1';
const DEMO_BASE = process.env.DEMO_BASE ?? '/Alayra-Nexus/demo/';

export default defineConfig({
  base: DEMO ? DEMO_BASE : '/',
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
    // The demo lands in the repo's docs/demo so GitHub Pages can publish it from the default branch
    // without a second deployment mechanism; the gateway's own bundle still goes to web/dist.
    outDir: DEMO ? '../docs/demo' : 'dist',
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
