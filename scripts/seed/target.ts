/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 */

// The seed script's safety gate, kept apart from the script so it can be tested.
//
// The generator's whole purpose is to produce data indistinguishable from real traffic. That makes
// it genuinely dangerous pointed at a production gateway: fabricated spend would corrupt cost
// reporting, fabricated audit rows would corrupt the evidence trail, and afterwards nobody could
// separate the two. So the gate fails closed — local hosts only, unless the operator names the
// remote host back to prove they meant that database and not the one still in their shell history.

/** Hosts that are unambiguously a developer's own machine or the compose network. */
export const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',              // the service name inside docker-compose
  'host.docker.internal',
]);

export interface TargetCheck {
  databaseUrl?:   string;
  allowRemote:    boolean;
  /** The host the operator typed back via --i-understand. */
  confirmedHost?: string;
}

/**
 * Returns the host when seeding it is permitted; throws with an actionable message when it is not.
 * Never returns a boolean — a caller cannot accidentally ignore a throw.
 */
export function assertSafeTarget(check: TargetCheck): string {
  if (!check.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Point it at a local gateway database and try again.');
  }

  let host: string;
  try {
    host = new URL(check.databaseUrl).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL, so its host cannot be checked. Refusing to run.');
  }
  if (!host) {
    throw new Error('DATABASE_URL has no host, so it cannot be checked. Refusing to run.');
  }

  if (LOCAL_HOSTS.has(host)) return host;

  // Two barriers rather than one. A lone --allow-remote is too easy to leave in a shell history and
  // re-run by arrow-key against a different DATABASE_URL; naming the host proves the intent was
  // about *this* database.
  if (!check.allowRemote) {
    throw new Error(
      `Refusing to seed a non-local database (host: ${host}).\n` +
      `This writes fabricated usage, costs and audit entries that cannot be told apart from real ones afterwards.\n` +
      `If you truly mean to, re-run with:  --allow-remote --i-understand ${host}`,
    );
  }
  if (check.confirmedHost !== host) {
    throw new Error(`--allow-remote requires --i-understand ${host} to confirm the exact target.`);
  }
  return host;
}
