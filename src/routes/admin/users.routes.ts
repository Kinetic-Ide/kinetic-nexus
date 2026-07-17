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

// The people who administer the gateway (Phase 7.13a).
//
// Reads are open to any admin — knowing who else can change the gateway you operate is not a
// privilege. Every write is OWNER-ONLY: managing people is precisely the authority that separates an
// owner from an admin, and an admin who could invite an owner or demote one would BE an owner.
import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  listUsers, updateUser, deleteUser,
  createInvite, listInvites, revokeInvite, peekInvite, acceptInvite,
  AdminUserError, INVITE_TTL_DAYS,
} from '../../services/adminUsers.service';
import { ROLE_LABELS } from '../../lib/roles';
import { adminGuard, adminOwnerGuard } from './guard';
import { AUTH_RATE_LIMIT, ADMIN_WRITE_RATE_LIMIT, rateLimited, withRateLimit } from '../../lib/routeRateLimits';
import { recordAudit } from '../../services/audit.service';
import { revokeAllSessions } from '../../services/adminAuth.service';

const roleSchema = z.enum(['owner', 'admin', 'viewer']);

/** Turn a service refusal into the status and words it already chose. */
function fail(reply: FastifyReply, e: unknown): FastifyReply {
  if (e instanceof AdminUserError) return reply.code(e.status).send({ error: e.message });
  throw e;
}

export default async function adminUsersRoutes(fastify: FastifyInstance) {
  // ── People ────────────────────────────────────────────────────────

  fastify.get('/admin/users', adminGuard, async (_req, reply) => {
    // `roles` travels with the list so the dashboard never hard-codes what a role means — the
    // explanation an operator reads when granting access comes from the same place the guard reads.
    return reply.send({ users: await listUsers(), roles: ROLE_LABELS });
  });

  fastify.patch('/admin/users/:id', adminOwnerGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({
      name:   z.string().min(1).max(80).optional(),
      role:   roleSchema.optional(),
      status: z.enum(['active', 'suspended']).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Nothing valid to change.' });

    // An owner cannot demote or suspend themselves. The last-owner invariant in the service would
    // catch the case that actually breaks the gateway, but not this one: with two owners, you could
    // still lock yourself out with a click and be left asking the other one to undo it.
    if (id === request.adminUserId && (parsed.data.role !== undefined || parsed.data.status !== undefined)) {
      return reply.code(400).send({ error: 'You cannot change your own role or status. Ask another owner.' });
    }

    try {
      const user = await updateUser(id, parsed.data);
      // Suspension ERASES the person's sessions rather than merely refusing them per-request:
      // a later restore must mean "sign in again", never the resurrection of every session
      // they held before — those are exactly the sessions an operator suspended to kill.
      if (parsed.data.status === 'suspended') await revokeAllSessions(id);
      return reply.send({ user });
    } catch (e) { return fail(reply, e); }
  });

  fastify.delete('/admin/users/:id', adminOwnerGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.adminUserId) {
      return reply.code(400).send({ error: 'You cannot remove your own account. Ask another owner.' });
    }
    try {
      // Sessions first, while the account still exists to look them up by.
      await revokeAllSessions(id);
      const { tokensRevoked } = await deleteUser(id);
      // The count is worth returning: "removed, and 3 of their API tokens stopped working" is the
      // answer to the question an operator is actually asking when they offboard someone.
      return reply.send({ success: true, tokensRevoked });
    } catch (e) { return fail(reply, e); }
  });

  // ── Invites ───────────────────────────────────────────────────────

  fastify.get('/admin/invites', adminGuard, async (_req, reply) => {
    return reply.send({ invites: await listInvites(), ttlDays: INVITE_TTL_DAYS });
  });

  fastify.post('/admin/invites', withRateLimit(adminOwnerGuard, ADMIN_WRITE_RATE_LIMIT), async (request, reply) => {
    const parsed = z.object({
      email: z.string().min(3).max(200),
      role:  roleSchema.default('viewer'),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'An email address and a role are required.' });

    try {
      const { invite, token } = await createInvite({ ...parsed.data, invitedById: request.adminUserId ?? null });
      // The token is returned exactly once, for the owner to hand over. It is stored only as a hash,
      // so it cannot be shown again — reissue by inviting the same address, which replaces this one.
      return reply.code(201).send({ invite, token });
    } catch (e) { return fail(reply, e); }
  });

  fastify.delete('/admin/invites/:id', adminOwnerGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await revokeInvite(id);
      return reply.send({ success: true });
    } catch (e) { return fail(reply, e); }
  });

  // ── Accepting an invite ───────────────────────────────────────────
  //
  // Unguarded by necessity: an invitee has no account yet, and the invite token IS the credential.
  // 192 bits, single use, expiring, stored only as a hash — and rate-limited at the sign-in tier
  // here, because guessing one would be guessing a credential.

  fastify.get('/admin/invites/accept', rateLimited(AUTH_RATE_LIMIT), async (request, reply) => {
    const { token } = request.query as { token?: string };
    const invite = await peekInvite(token ?? '');
    // Deliberately flat: expired, spent, and never-existed all answer the same way. The difference
    // is of no use to the invitee and of real use to someone fishing for live tokens.
    if (!invite) return reply.code(404).send({ error: 'That invite link is not valid or has expired.' });
    return reply.send({ invite, roles: ROLE_LABELS });
  });

  fastify.post('/admin/invites/accept', rateLimited(AUTH_RATE_LIMIT), async (request, reply) => {
    const parsed = z.object({
      token:    z.string().min(1).max(200),
      name:     z.string().min(1).max(80),
      password: z.string().min(1).max(200),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Enter your name and a password.' });

    try {
      // Note what the invitee does NOT get to send: their email or their role. Both come off the
      // invite the owner created, so accepting cannot make you someone else, or something more.
      const { user, recoveryKey } = await acceptInvite(parsed.data.token, {
        name: parsed.data.name, password: parsed.data.password,
      });
      recordAudit({
        action: 'users.join', method: 'POST', actorRole: user.role,
        actorId: user.id, actorName: user.name, target: user.id, ip: request.ip, status: 201,
        detail: JSON.stringify({ email: user.email, role: user.role }),
      });
      return reply.code(201).send({ user, recoveryKey });
    } catch (e) { return fail(reply, e); }
  });
}
