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

// The Health page's read (Phase 7.12): one aggregate with the live status, the readiness checks,
// Redis/Postgres/process detail, and the sampled history behind the sparklines and the status
// strip. Admin-guarded — memory sizes, table names and connection counts are operator facts, not
// public ones (the public surface is /ready, which says only ready-or-not).

import { FastifyInstance } from 'fastify';
import { getHealthOverview } from '../../services/healthSampler.service';
import { adminGuard } from './guard';

export default async function adminHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/health/overview', adminGuard, async (_req, reply) => {
    return reply.send(await getHealthOverview());
  });
}
