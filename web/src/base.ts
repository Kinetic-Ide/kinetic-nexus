/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Alayra Nexus™ is a trademark of Alayra Systems. Use of the name or logo
 * is not granted by the software license below.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for details.
 */

// Where the dashboard is mounted.
//
// The gateway always serves it from the site root, so this is '' in every real deployment and the
// production build behaves exactly as it did before this file existed. It is non-empty only for the
// static demo, which GitHub Pages serves from a sub-path (/Alayra-Nexus/demo/).
//
// preact-iso's router does NOT strip a base: its `scope` prop only decides which link clicks to
// intercept, while `useLocation().path` is the raw pathname. So a prefix has to be added when
// building an href and removed when matching a route — which is exactly what this module is for.

/**
 * The mount path, with no trailing slash. `''` at the site root.
 *
 * Vite sets BASE_URL from `base` in the config; it is '/' for a root build. The `import.meta.env`
 * guard keeps this working under vitest, where the field can be absent.
 */
export const BASE: string = (() => {
  const raw = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/';
  const trimmed = (raw ?? '/').replace(/\/+$/, '');
  return trimmed === '' ? '' : trimmed;
})();

/** Turn an app path ('/teams') into a URL for this deployment ('/teams', or '/demo/teams'). */
export function href(path: string): string {
  if (!BASE) return path;
  return path === '/' ? `${BASE}/` : `${BASE}${path}`;
}

/**
 * Turn a browser pathname back into an app path — the inverse of `href`. Anything outside the mount
 * point is returned unchanged, so an unexpected URL falls through to the not-found route rather than
 * being silently rewritten into a page that happens to match.
 */
export function appPath(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE || pathname === `${BASE}/`) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}
