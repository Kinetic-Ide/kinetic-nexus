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

// The base URL the dashboard tells you to paste into Cursor, Cline, or an SDK. It has
// to be exactly right: a URL that silently drops its port produces a client that
// cannot connect, with no clue as to why.
//
// Where the truth comes from, in order (P7.14):
//   1. PUBLIC_URL env — the operator SAID so. Absolute; wins over everything.
//   2. X-Forwarded-Proto / X-Forwarded-Host — the proxy said how the client reached it.
//   3. The Host header — direct exposure, scheme assumed http.
// The known hole in 2–3: a proxy that forwards Host but omits X-Forwarded-Proto makes a
// TLS deployment print `http://` with total confidence — the gateway cannot observe TLS
// it did not terminate. PUBLIC_URL exists for exactly that proxy; the dashboard's Connect
// page additionally cross-checks against the browser's own address bar, the one witness
// that cannot be lied to about the scheme.

export interface BaseUrlSource {
  /** `request.host` — the Host header, *including* the port. */
  host: string;
  forwardedProto?: string | string[];
  forwardedHost?:  string | string[];
}

/** Where a resolved origin's authority came from — surfaced to the dashboard so it can say so. */
export type OriginSource = 'env' | 'proxy' | 'host';

/** A proxy may send a comma-separated list; the first entry is the original client. */
function firstValue(v: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  const first = raw?.split(',')[0]?.trim();
  return first || undefined;
}

/**
 * Build the public `/v1` base URL for this deployment.
 *
 * Behind a reverse proxy the `X-Forwarded-*` headers describe how the client reached
 * us, and win. Otherwise the Host header is used verbatim.
 *
 * Use `request.host`, never `request.hostname`: Fastify v5 changed `hostname` to strip
 * the port, so on `localhost:3000` it yields `localhost` and the dashboard hands out
 * `http://localhost/v1` — a base URL that connects to nothing.
 */
export function buildBaseUrl(src: BaseUrlSource): string {
  return `${buildOrigin(src)}/v1`;
}

/**
 * The public origin (`scheme://host[:port]`) for this deployment, using the same
 * reverse-proxy rules as buildBaseUrl. Used to construct absolute callback URLs — an
 * OIDC `redirect_uri` must be the externally-reachable address, not the internal host.
 */
export function buildOrigin(src: BaseUrlSource): string {
  const proto = firstValue(src.forwardedProto) ?? 'http';
  const host  = firstValue(src.forwardedHost)  ?? src.host;
  return `${proto}://${host}`;
}

/**
 * Normalize an operator-supplied PUBLIC_URL into a bare origin, or throw with the reason.
 * Forgiving about the shapes people actually paste (trailing slash, an included /v1 —
 * both stripped); strict about everything else, because every URL the gateway ever
 * prints inherits this value. Any path beyond /v1 is refused rather than guessed at.
 */
export function normalizePublicUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error(`PUBLIC_URL is not a valid URL: "${raw}". Expected e.g. https://gateway.example.com`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`PUBLIC_URL must be http(s), got "${u.protocol}//". Expected e.g. https://gateway.example.com`);
  }
  if (u.search || u.hash || u.username || u.password) {
    throw new Error('PUBLIC_URL must be a bare origin — no query, fragment, or credentials.');
  }
  const path = u.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/v1') {
    throw new Error(`PUBLIC_URL must not carry a path (got "${u.pathname}"). The gateway appends /v1 itself.`);
  }
  return `${u.protocol}//${u.host}`;
}

export interface ResolvedOrigin {
  origin: string;
  source: OriginSource;
}

/**
 * The public origin with its provenance: the PUBLIC_URL pin when the operator set one,
 * otherwise inference from the request. Routes that print URLs go through THIS; the
 * `source` rides to the dashboard so it can tell the operator which authority spoke.
 */
export function resolvePublicOrigin(src: BaseUrlSource): ResolvedOrigin {
  const pinned = process.env.PUBLIC_URL?.trim();
  if (pinned) return { origin: normalizePublicUrl(pinned), source: 'env' };
  return {
    origin: buildOrigin(src),
    source: firstValue(src.forwardedProto) || firstValue(src.forwardedHost) ? 'proxy' : 'host',
  };
}
