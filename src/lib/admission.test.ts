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

import { describe, it, expect, vi } from 'vitest';

// admission.ts imports the real ioredis client, which connects (and throws when
// REDIS_URL is unset) at module load. These are pure-helper tests, so we mock the
// Redis module — no connection is attempted. The admitKey / reconcileTpm Lua paths
// are exercised against a real Redis in the integration suite (Phase 13).
vi.mock('./redis', () => ({ redis: { eval: vi.fn() } }));

import { beforeEach } from 'vitest';
import { rpmKey, tpmKey, usersKey, admitUser, RPM_TPM_WINDOW_SECONDS, MAXUSERS_WINDOW_SECONDS } from './admission';
import { redis } from './redis';

describe('admission key derivation', () => {
  it('namespaces RPM keys per key id', () => {
    expect(rpmKey('abc123')).toBe('nexus:rpm:abc123');
  });

  it('namespaces TPM keys per key id', () => {
    expect(tpmKey('abc123')).toBe('nexus:tpm:abc123');
  });

  it('namespaces the distinct-users set per key id', () => {
    expect(usersKey('abc123')).toBe('nexus:users:abc123');
  });

  it('keeps RPM and TPM counters in separate namespaces', () => {
    expect(rpmKey('same')).not.toBe(tpmKey('same'));
  });

  it('uses a 60-second window', () => {
    expect(RPM_TPM_WINDOW_SECONDS).toBe(60);
  });

  it('counts distinct users over a rolling day by default', () => {
    expect(MAXUSERS_WINDOW_SECONDS).toBe(86400);
  });
});

describe('admitUser — per-key Max Users cap', () => {
  beforeEach(() => { vi.mocked(redis.eval).mockReset(); });

  it('admits without touching Redis when the request carries no user id', async () => {
    // No identity signal means the cap is unenforceable — a missing `user` must never block traffic.
    await expect(admitUser('key-1', 5, null)).resolves.toBe(true);
    await expect(admitUser('key-1', 5, undefined)).resolves.toBe(true);
    await expect(admitUser('key-1', 5, '')).resolves.toBe(true);
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('admits when the script reports the user is known or the key has room', async () => {
    vi.mocked(redis.eval).mockResolvedValue(1 as never);
    await expect(admitUser('key-1', 5, 'user-a')).resolves.toBe(true);
  });

  it('rejects a new user once the key is at its cap', async () => {
    vi.mocked(redis.eval).mockResolvedValue(0 as never);
    await expect(admitUser('key-1', 5, 'user-z')).resolves.toBe(false);
  });

  it('passes the key set, user id, cap, and window to the script', async () => {
    vi.mocked(redis.eval).mockResolvedValue(1 as never);
    await admitUser('key-1', 5, 'user-a', 3600);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String), 1, 'nexus:users:key-1', 'user-a', '5', '3600',
    );
  });

  it('clamps a nonsensical cap to at least one user', async () => {
    vi.mocked(redis.eval).mockResolvedValue(1 as never);
    await admitUser('key-1', 0, 'user-a', 3600);
    expect(vi.mocked(redis.eval).mock.calls[0][4]).toBe('1');
  });
});
