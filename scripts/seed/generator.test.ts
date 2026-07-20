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
import { generate, summarise, SEED_MODELS, SEED_TEAMS, SEED_ACTORS, type GenerateOptions } from './generator';

const NOW = new Date('2026-07-20T12:00:00.000Z');
const OPTS: GenerateOptions = { now: NOW, days: 14, seed: 42, peakRequestsPerDay: 300 };

describe('seed generator', () => {
  it('is deterministic — the same seed yields identical data', () => {
    const a = generate(OPTS);
    const b = generate(OPTS);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('produces different data for a different seed', () => {
    const a = generate(OPTS);
    const b = generate({ ...OPTS, seed: 43 });
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });

  it('places every record inside the requested window and never in the future', () => {
    const { usage, audit, notifications } = generate(OPTS);
    const earliest = new Date(NOW);
    earliest.setUTCDate(earliest.getUTCDate() - OPTS.days);
    earliest.setUTCHours(0, 0, 0, 0);

    for (const row of [...usage, ...audit, ...notifications]) {
      expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
      expect(row.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  // The money columns are the ones a sceptical reader checks, so they get the strictest tests.
  it('records no tokens and no cost for a failed request', () => {
    const failures = generate(OPTS).usage.filter((u) => u.outcome !== 'success');
    expect(failures.length).toBeGreaterThan(0);
    for (const f of failures) {
      expect(f.inputTokens).toBe(0);
      expect(f.outputTokens).toBe(0);
      expect(f.totalTokens).toBe(0);
      expect(f.estimatedUsd).toBe(0);
      expect(f.savedUsd).toBe(0);
    }
  });

  it('charges nothing for a cache hit and records what it saved', () => {
    const cached = generate(OPTS).usage.filter((u) => u.cached);
    expect(cached.length).toBeGreaterThan(0);
    for (const row of cached) {
      expect(row.estimatedUsd).toBe(0);
      expect(row.savedUsd).toBeGreaterThan(0);
      // A cache hit never called a provider, so it must be fast.
      expect(row.latencyMs).toBeLessThan(100);
    }
  });

  it('prices every uncached success from the model catalogue', () => {
    const rows = generate(OPTS).usage.filter((u) => u.outcome === 'success' && !u.cached);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows.slice(0, 200)) {
      const model = SEED_MODELS.find((m) => m.id === row.modelId);
      expect(model).toBeDefined();
      const expected =
        Math.round((row.inputTokens  / 1e6) * model!.inputCostPer1M  * 1e6) / 1e6 +
        Math.round((row.outputTokens / 1e6) * model!.outputCostPer1M * 1e6) / 1e6;
      expect(row.estimatedUsd).toBeCloseTo(expected, 6);
    }
  });

  it('totals add up to the reported summary', () => {
    const data = generate(OPTS);
    const totals = summarise(data);
    const successful = data.usage.filter((u) => u.outcome === 'success');

    expect(totals.requests).toBe(data.usage.length);
    expect(totals.successful).toBe(successful.length);
    expect(totals.inputTokens).toBe(successful.reduce((n, u) => n + u.inputTokens, 0));
    expect(totals.costUsd).toBeCloseTo(successful.reduce((n, u) => n + u.estimatedUsd, 0), 1);
  });

  it('is mostly successful but never perfect — the reliability panel needs a real error band', () => {
    const totals = summarise(generate(OPTS));
    const rate = totals.successful / totals.requests;
    expect(rate).toBeGreaterThan(0.9);
    expect(rate).toBeLessThan(1);
  });

  it('attributes every request to a known team key', () => {
    const known = new Set(SEED_TEAMS.flatMap((t) => t.keyNames));
    for (const row of generate(OPTS).usage) {
      expect(known.has(row.teamKeyName)).toBe(true);
    }
  });

  it('shows weekday traffic clearly above weekend traffic', () => {
    const byDay = new Map<number, number>();
    for (const row of generate({ ...OPTS, days: 28 }).usage) {
      const day = row.createdAt.getUTCDay();
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const weekend = (byDay.get(0) ?? 0) + (byDay.get(6) ?? 0);
    const midweek = (byDay.get(2) ?? 0) + (byDay.get(3) ?? 0);
    expect(midweek).toBeGreaterThan(weekend * 1.5);
  });

  it('leaves the newest notifications unread, including a critical one', () => {
    const notes = generate(OPTS).notifications;
    const unread = notes.filter((n) => n.readAt === null);
    expect(unread.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.severity === 'critical')).toBe(true);
  });

  it('records failed sign-ins with no named actor', () => {
    const failures = generate(OPTS).audit.filter((a) => a.status === 401);
    expect(failures.length).toBeGreaterThan(0);
    for (const f of failures) {
      expect(f.actorName).toBe('');
      expect(f.actorRole).toBe('system');
    }
  });

  // The gateway refuses writes from a viewer, so an audit trail showing one would contradict the
  // product's own role model in a screenshot.
  it('never attributes a write action to a viewer', () => {
    const viewerNames = new Set(SEED_ACTORS.filter((a) => a.role === 'viewer').map((a) => a.name));
    const writeActions = /^(keys|teams|models|providers|settings)\./;

    const audit = generate({ ...OPTS, days: 60 }).audit;
    const writes = audit.filter((a) => writeActions.test(a.action));
    expect(writes.length).toBeGreaterThan(0);

    for (const row of writes) {
      expect(row.actorRole).not.toBe('viewer');
      expect(viewerNames.has(row.actorName)).toBe(false);
    }
  });

  it('still lets a viewer sign in and out', () => {
    const audit = generate({ ...OPTS, days: 60 }).audit;
    expect(audit.some((a) => a.action.startsWith('auth.') && a.actorRole === 'viewer')).toBe(true);
  });

  it('returns audit entries newest first', () => {
    const audit = generate(OPTS).audit;
    for (let i = 1; i < audit.length; i++) {
      expect(audit[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(audit[i].createdAt.getTime());
    }
  });
});
