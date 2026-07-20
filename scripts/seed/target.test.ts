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
import { assertSafeTarget } from './target';

const LOCAL  = 'postgresql://nexus:nexus@localhost:5432/nexus';
const REMOTE = 'postgresql://user:pw@nexus-db.railway.internal:5432/railway';

describe('seed target guard', () => {
  it('allows a localhost target', () => {
    expect(assertSafeTarget({ databaseUrl: LOCAL, allowRemote: false })).toBe('localhost');
  });

  it('allows the compose service host and the docker gateway host', () => {
    for (const host of ['postgres', 'host.docker.internal', '127.0.0.1']) {
      const url = `postgresql://u:p@${host}:5432/nexus`;
      expect(assertSafeTarget({ databaseUrl: url, allowRemote: false })).toBe(host);
    }
  });

  // The one that actually matters: the default path must never write to production.
  it('refuses a remote target by default', () => {
    expect(() => assertSafeTarget({ databaseUrl: REMOTE, allowRemote: false }))
      .toThrow(/Refusing to seed a non-local database/);
  });

  it('names the offending host and the exact escape hatch in the refusal', () => {
    try {
      assertSafeTarget({ databaseUrl: REMOTE, allowRemote: false });
      throw new Error('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('nexus-db.railway.internal');
      expect(message).toContain('--allow-remote --i-understand nexus-db.railway.internal');
    }
  });

  it('still refuses a remote target when --allow-remote is given alone', () => {
    expect(() => assertSafeTarget({ databaseUrl: REMOTE, allowRemote: true }))
      .toThrow(/requires --i-understand/);
  });

  it('refuses when the confirmed host does not match the actual host', () => {
    expect(() => assertSafeTarget({
      databaseUrl: REMOTE, allowRemote: true, confirmedHost: 'some-other-host',
    })).toThrow(/requires --i-understand/);
  });

  it('permits a remote target only when both barriers are cleared', () => {
    expect(assertSafeTarget({
      databaseUrl: REMOTE, allowRemote: true, confirmedHost: 'nexus-db.railway.internal',
    })).toBe('nexus-db.railway.internal');
  });

  it('refuses when DATABASE_URL is missing or unparseable', () => {
    expect(() => assertSafeTarget({ allowRemote: false })).toThrow(/DATABASE_URL is not set/);
    expect(() => assertSafeTarget({ databaseUrl: 'not a url', allowRemote: false }))
      .toThrow(/not a valid URL|no host/);
  });

  // A hostname that merely *contains* "localhost" is not localhost, and must not be treated as one.
  it('does not treat a lookalike hostname as local', () => {
    for (const host of ['localhost.evil.com', 'notlocalhost', 'my-localhost-db']) {
      expect(() => assertSafeTarget({ databaseUrl: `postgresql://u:p@${host}:5432/n`, allowRemote: false }))
        .toThrow(/Refusing to seed a non-local database/);
    }
  });
});
