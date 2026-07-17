import type { AdminRole } from '../api';

// What the signed-in role is allowed to CHANGE (Phase 7.13b) — the dashboard-side mirror of the
// server's three guards: adminGuard (any role reads), adminWriteGuard (admin and owner write),
// adminOwnerGuard (owner alone).
//
// Nothing here is a permission. Every rule is enforced by the server on each request; these
// helpers only decide whether to RENDER a control, so a viewer is not offered buttons that can
// only ever answer 403. Someone who edits their sessionStorage role sees more buttons and gets
// refused on every one of them.
//
// Reads sessionStorage directly rather than importing api.getIdentity: half the test suite
// replaces '../api' with a bare mock, and a presentation helper must not force every one of
// those mocks to re-declare the auth surface. The key and shape are api.ts's — see setIdentity.

export function role(): AdminRole {
  try {
    const raw = sessionStorage.getItem('nx_identity');
    const parsed = raw ? (JSON.parse(raw) as { role?: AdminRole }) : null;
    // No identity — a pre-accounts session, or storage was cleared. Assume the least until the
    // server says otherwise: a hidden button costs a reload, a wrongly-shown one costs trust.
    return parsed?.role ?? 'viewer';
  } catch {
    return 'viewer';
  }
}

/** Mirrors adminWriteGuard: may this person change day-to-day things (pools, keys, teams, cache, settings)? */
export const canWrite = (): boolean => role() !== 'viewer';

/** Mirrors adminOwnerGuard: people, API tokens, key rotation, network policy, compliance, the reset. */
export const isOwner = (): boolean => role() === 'owner';
