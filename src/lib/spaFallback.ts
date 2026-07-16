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

// SPA deep-link fallback (Phase 7.9 cutover). The redesigned dashboard is a single-page app with
// real client-side routes (/teams, /nexus, /caching, /admin …). The static plugin serves index.html
// at `/` and the built assets, but a direct hit on a deep link — a refresh or a bookmark — matches no
// file and no API route, so it reaches the not-found handler. For a *browser navigation* we hand back
// index.html and let the client router take over; everything else keeps the honest JSON 404.
//
// The discriminator is the request itself, not a hard-coded route list (which would rot as sections are
// added): a browser navigating sends `Accept: text/html`; an API client (the dashboard's own fetch, a
// script, curl) sends `*/*` or `application/json`. So an unknown `/admin/thing` from the dashboard's
// fetch still 404s as JSON, while `/admin` typed into the address bar serves the app.
//
// The gateway's own API/infra namespaces are excluded outright: a browser opening an unknown `/v1/...`,
// `/health`, or `/metrics` path should get the API's 404, never the dashboard shell.

/** True when a not-found request should be answered with the SPA's index.html. `pathname` must be
 *  the URL path with any query string already stripped. */
export function isSpaNavigation(method: string, accept: string | undefined, pathname: string): boolean {
  const isGet = method === 'GET' || method === 'HEAD';
  if (!isGet) return false;
  if (!(accept ?? '').includes('text/html')) return false;
  // API/infra namespaces never fall back to the dashboard.
  if (pathname === '/health' || pathname === '/metrics') return false;
  if (pathname === '/v1' || pathname.startsWith('/v1/')) return false;
  return true;
}
