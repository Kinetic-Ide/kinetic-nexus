import { describe, it, expect, vi } from 'vitest';

// admission.ts imports the real ioredis client, which connects (and throws when
// REDIS_URL is unset) at module load. These are pure-helper tests, so we mock the
// Redis module — no connection is attempted. The admitKey / reconcileTpm Lua paths
// are exercised against a real Redis in the integration suite (Phase 13).
vi.mock('./redis', () => ({ redis: { eval: vi.fn() } }));

import { rpmKey, tpmKey, RPM_TPM_WINDOW_SECONDS } from './admission';

describe('admission key derivation', () => {
  it('namespaces RPM keys per key id', () => {
    expect(rpmKey('abc123')).toBe('nexus:rpm:abc123');
  });

  it('namespaces TPM keys per key id', () => {
    expect(tpmKey('abc123')).toBe('nexus:tpm:abc123');
  });

  it('keeps RPM and TPM counters in separate namespaces', () => {
    expect(rpmKey('same')).not.toBe(tpmKey('same'));
  });

  it('uses a 60-second window', () => {
    expect(RPM_TPM_WINDOW_SECONDS).toBe(60);
  });
});
