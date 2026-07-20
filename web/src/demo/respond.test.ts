/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 */

import { describe, it, expect } from 'vitest';
import { demoRespond, DemoReadOnlyError, DemoUnhandledError } from './respond';
import dataset from './dataset.json';

describe('demo responder — reads', () => {
  // Every path the dashboard actually requests. If a page is added that fetches something new, this
  // list is where the omission shows up, rather than as a blank panel in the published demo.
  const PATHS = [
    '/admin/overview',
    '/admin/analytics/overview?period=30d',
    '/admin/nexus/overview',
    '/admin/models',
    '/admin/teams',
    '/admin/audit?limit=50',
    '/admin/notifications?limit=20',
    '/admin/health/overview',
    '/admin/cache/stats',
    '/admin/settings/cache',
    '/admin/settings/routing',
    '/admin/settings/compliance',
    '/admin/settings/guardrails',
    '/admin/settings/ssrf',
    '/admin/settings/notifications',
    '/admin/branding',
    '/admin/config',
    '/admin/invites',
    '/admin/providers',
    '/admin/me',
    '/admin/me/sessions',
    '/admin/auth/status',
    '/admin/setup/status',
  ];

  it.each(PATHS)('answers GET %s', (path) => {
    const res = demoRespond<unknown>('GET', path);
    expect(res).toBeDefined();
    expect(res).not.toBeNull();
  });

  it('returns the real overview aggregate', () => {
    const res = demoRespond<typeof dataset.overview>('GET', '/admin/overview');
    expect(res.stats.totalRequests).toBe(dataset.overview.stats.totalRequests);
    expect(res.series7d.length).toBeGreaterThan(0);
  });

  it('selects the analytics window from the query string', () => {
    for (const period of ['today', '7d', '30d', '90d'] as const) {
      const res = demoRespond<unknown>('GET', `/admin/analytics/overview?period=${period}`);
      expect(res).toEqual(dataset.analytics[period]);
    }
  });

  it('falls back to a sane window when the period is missing or nonsense', () => {
    expect(demoRespond('GET', '/admin/analytics/overview')).toEqual(dataset.analytics['30d']);
    expect(demoRespond('GET', '/admin/analytics/overview?period=fortnight')).toEqual(dataset.analytics['30d']);
  });

  it('serves per-team stats for every team and window', () => {
    for (const team of dataset.teams) {
      for (const period of ['today', '7d', '30d', '90d']) {
        const res = demoRespond<unknown>('GET', `/admin/teams/${team.id}/stats?period=${period}`);
        expect(res).toEqual((dataset.teamStats as Record<string, unknown>)[`${team.id}:${period}`]);
      }
    }
  });

  it('serves the wire envelope, not the bare service return', () => {
    // The route wraps the audit service's array in `{ entries }`; the client unwraps that. A fixture
    // stored in the service's shape would render an empty log with no error anywhere.
    expect(demoRespond<{ entries: unknown[] }>('GET', '/admin/audit?limit=50')).toHaveProperty('entries');
    expect(demoRespond<{ teams: unknown[] }>('GET', '/admin/teams')).toHaveProperty('teams');
  });

  it('hands back the larger audit page when a bigger limit is asked for', () => {
    const small = demoRespond<{ entries: unknown[] }>('GET', '/admin/audit?limit=50');
    const large = demoRespond<{ entries: unknown[] }>('GET', '/admin/audit?limit=200');
    expect(large.entries.length).toBeGreaterThan(small.entries.length);
  });

  it('ignores a trailing slash', () => {
    expect(demoRespond('GET', '/admin/teams/')).toEqual(demoRespond('GET', '/admin/teams'));
  });
});

describe('demo responder — writes', () => {
  // A demo that appears to save and silently forgets is worse than one that says what it is.
  it.each([
    ['POST',   '/admin/teams'],
    ['PATCH',  '/admin/teams/abc'],
    ['PUT',    '/admin/models'],
    ['DELETE', '/admin/models/gpt-4o'],
  ])('refuses %s %s', (method, path) => {
    expect(() => demoRespond(method, path)).toThrow(DemoReadOnlyError);
  });

  it('explains itself and points at the real thing', () => {
    try {
      demoRespond('POST', '/admin/teams');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/read-only demo/i);
      expect((err as DemoReadOnlyError).status).toBe(403);
    }
  });
});

describe('demo responder — gaps', () => {
  // Loud, not silent: an unfixtured path should be obvious in development rather than rendering an
  // empty panel in the published demo.
  it('throws a named error for an unknown path', () => {
    expect(() => demoRespond('GET', '/admin/something-new')).toThrow(DemoUnhandledError);
    expect(() => demoRespond('GET', '/admin/something-new')).toThrow(/no fixture for GET/);
  });

  it('throws for a team that does not exist rather than inventing one', () => {
    expect(() => demoRespond('GET', '/admin/teams/no-such-team/stats')).toThrow(DemoUnhandledError);
  });
});
