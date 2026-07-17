import { describe, it, expect, beforeEach } from 'vitest';
import { role, canWrite, isOwner } from './access';

// The dashboard-side mirror of the server's three guards (7.13b). These read the identity the
// sign-in stored; the tests write it the same way api.setIdentity does.

const setRole = (r: string) =>
  sessionStorage.setItem('nx_identity', JSON.stringify({ role: r, userId: 'u1', name: 'A' }));

beforeEach(() => sessionStorage.clear());

describe('access — the role ladder', () => {
  it('an owner can do everything', () => {
    setRole('owner');
    expect(role()).toBe('owner');
    expect(canWrite()).toBe(true);
    expect(isOwner()).toBe(true);
  });

  it('an admin writes but does not own', () => {
    setRole('admin');
    expect(canWrite()).toBe(true);
    expect(isOwner()).toBe(false);
  });

  it('a viewer changes nothing', () => {
    setRole('viewer');
    expect(canWrite()).toBe(false);
    expect(isOwner()).toBe(false);
  });

  it('assumes the least when no identity is stored', () => {
    // A pre-accounts session or cleared storage: a hidden button costs a reload,
    // a wrongly-shown one costs trust.
    expect(role()).toBe('viewer');
    expect(canWrite()).toBe(false);
  });

  it('assumes the least when the stored identity is garbage', () => {
    sessionStorage.setItem('nx_identity', 'not json {');
    expect(role()).toBe('viewer');
  });
});
