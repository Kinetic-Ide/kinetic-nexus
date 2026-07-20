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

// The demo's entire backend.
//
// Every typed helper in api.ts funnels through one `api(method, path, body)` call, so the static
// demo needs to answer exactly that one function — not reimplement a 641-line client. This maps a
// method and path onto the frozen dataset in ./dataset.json, which was produced by running the real
// services against a seeded gateway (see scripts/demo/buildFixtures.ts).
//
// None of this reaches a production bundle: the only caller is guarded by `import.meta.env.VITE_DEMO`,
// a compile-time constant, so Rollup removes the branch and tree-shakes this module away entirely.

import dataset from './dataset.json';

/** Thrown for a write, so callers show their normal error path rather than appearing to succeed. */
export class DemoReadOnlyError extends Error {
  readonly status = 403;
  constructor() {
    super('This is a read-only demo — changes are not saved. Run the gateway to try it for real.');
    this.name = 'DemoReadOnlyError';
  }
}

/** Thrown when the demo has no fixture for a path, so a gap is loud in development. */
export class DemoUnhandledError extends Error {
  readonly status = 404;
  constructor(method: string, path: string) {
    super(`The demo has no fixture for ${method} ${path}.`);
    this.name = 'DemoUnhandledError';
  }
}

/** Strip the query string and any trailing slash, so '/admin/teams/?x=1' matches '/admin/teams'. */
function normalise(path: string): string {
  const [p] = path.split('?');
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

function query(path: string): URLSearchParams {
  const i = path.indexOf('?');
  return new URLSearchParams(i === -1 ? '' : path.slice(i + 1));
}

type Period = 'today' | '7d' | '30d' | '90d';
const PERIODS: readonly Period[] = ['today', '7d', '30d', '90d'];

function period(path: string, fallback: Period = '7d'): Period {
  const raw = query(path).get('period');
  return PERIODS.includes(raw as Period) ? (raw as Period) : fallback;
}

/** The signed-in identity the demo presents: a viewer, so no write control is offered at all. */
export const DEMO_IDENTITY = {
  role:   'viewer' as const,
  userId: 'demo-viewer',
  name:   'Demo visitor',
};

/**
 * Answer one API call from the frozen dataset.
 *
 * Writes are refused rather than faked. A demo that appears to save and then silently forgets is a
 * worse experience than one that says plainly what it is — and because the demo signs in as a
 * viewer, the UI hides write controls anyway; this is the backstop for anything that slips through.
 */
export function demoRespond<T>(method: string, path: string): T {
  const m = method.toUpperCase();
  const p = normalise(path);

  if (m !== 'GET') throw new DemoReadOnlyError();

  switch (p) {
    case '/admin/overview':            return dataset.overview as T;
    case '/admin/analytics/overview':  return dataset.analytics[period(path, '30d')] as T;
    case '/admin/nexus/overview':      return dataset.nexus as T;
    case '/admin/models':              return dataset.models as T;
    case '/admin/teams':               return { teams: dataset.teams } as T;
    case '/admin/audit':               return (Number(query(path).get('limit')) > 50 ? dataset.auditLarge : dataset.audit) as T;
    case '/admin/notifications':       return dataset.notifications as T;
    case '/admin/health/overview':     return dataset.health as T;
    case '/admin/cache/stats':         return dataset.cacheStats as T;
    case '/admin/settings/cache':      return dataset.cacheConfig as T;

    // Identity and session shape, so the shell renders a signed-in viewer.
    case '/admin/me':
      return { user: { id: DEMO_IDENTITY.userId, name: DEMO_IDENTITY.name, email: 'demo@example.invalid', role: 'viewer' }, role: 'viewer' } as T;
    case '/admin/me/sessions':
      return { sessions: [] } as T;
    case '/admin/auth/status':
      return { totpEnabled: false, recoveryCodesRemaining: 0 } as T;

    // Configuration surfaces. The demo shows the shipped defaults rather than a operator's tuning,
    // which is both more representative and avoids implying a setting we did not capture.
    case '/admin/settings/routing':     return { costWeight: dataset.nexus?.routing?.costWeight ?? 0 } as T;
    case '/admin/settings/notifications': return { channels: [] } as T;
    case '/admin/settings/compliance':  return { auditRetentionDays: 90, usageRetentionDays: 90, anonymize: false } as T;
    case '/admin/settings/guardrails':  return { enabled: false, rules: [] } as T;
    case '/admin/settings/ssrf':        return { allowPrivateHosts: false, allowlist: [] } as T;
    case '/admin/branding':             return { companyName: null, logoDataUri: null } as T;
    case '/admin/config':               return { publicUrl: 'https://nexus.example.com', source: 'demo' } as T;
    case '/admin/invites':              return { invites: [] } as T;
    case '/admin/providers':            return { providers: dataset.nexus?.tiers?.flatMap((t) => t.providers) ?? [] } as T;
    case '/admin/setup/status':         return { claimed: true } as T;
  }

  // Per-team stats: /admin/teams/:id/stats
  const stats = p.match(/^\/admin\/teams\/([^/]+)\/stats$/);
  if (stats) {
    const key = `${stats[1]}:${period(path)}`;
    const found = (dataset.teamStats as Record<string, unknown>)[key];
    if (found) return found as T;
  }

  throw new DemoUnhandledError(m, p);
}

/** True when this build is the static demo. A compile-time constant, so it folds away in production. */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
