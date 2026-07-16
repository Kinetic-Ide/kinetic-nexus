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

// Startup diagnostics. Pure string formatting only — the checks that actually open
// connections live in services/preflight.service.ts.
//
// The gateway hard-depends on Postgres and Redis. When either is missing the driver
// reports it as a retry storm followed by an opaque error, which tells an operator
// nothing about what to start. These helpers turn that into an instruction.

export type Dependency = 'redis' | 'database';

/**
 * Reduce a connection URL to `host:port` for display.
 *
 * Connection URLs routinely carry a password (`redis://:secret@host:6379`,
 * `postgresql://user:secret@host/db`). A startup error is printed to stdout and
 * scraped into log aggregators, so the credential must never survive this function.
 * Anything unparseable degrades to a constant rather than echoing the raw string.
 */
export function redactUrl(raw: string | undefined): string {
  if (!raw) return '(not set)';
  try {
    const u = new URL(raw);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '(unparseable URL)';
  }
}

const HELP: Record<Dependency, { label: string; envVar: string; hint: string[] }> = {
  redis: {
    label:  'Redis',
    envVar: 'REDIS_URL',
    hint: [
      'Start it with Docker:',
      '    docker compose up -d redis',
      '',
      'Redis is required — it holds rate-limit counters, circuit-breaker state,',
      'sticky routing, team budgets, and the response cache.',
    ],
  },
  database: {
    label:  'PostgreSQL',
    envVar: 'DATABASE_URL',
    hint: [
      'Start it with Docker, then apply migrations:',
      '    docker compose up -d postgres',
      '    npm run migrate',
      '',
      'Postgres stores provider pools, keys, the model registry, teams, and usage.',
    ],
  },
};

/**
 * A single, actionable startup failure message. Deliberately not an exception dump:
 * the stack of an ECONNREFUSED tells an operator nothing they can act on.
 */
export function formatStartupFailure(dep: Dependency, url: string | undefined, err: unknown): string {
  const { label, envVar, hint } = HELP[dep];
  const reason = err instanceof Error ? err.message : String(err);
  return [
    '',
    `✗  Cannot reach ${label} at ${redactUrl(url)}`,
    '',
    `   ${envVar}=${redactUrl(url)}`,
    `   ${reason}`,
    '',
    ...hint.map((l) => (l ? `   ${l}` : '')),
    '',
    '   To preview the dashboard without any services, run its dev server on its own:',
    '       npm --prefix web run dev',
    '',
  ].join('\n');
}
