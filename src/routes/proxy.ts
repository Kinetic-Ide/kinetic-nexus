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

import { FastifyInstance } from 'fastify';
import { verifyApiKey }   from '../middleware/auth.middleware';
import { handleProxy }    from '../services/completionsProxy.service';
import type { CompletionsBody } from '../services/completionsProxy.service';
import { anthropicToOpenAI } from '../lib/anthropic';
import { createAnthropicReply } from '../lib/anthropicReply';
import { dispatchProxy, embeddingReserve, completionReserve, imageReserve, imageQuantity } from '../services/proxyDispatch.service';

export default async function proxyRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/chat/completions', { preHandler: [verifyApiKey] }, async (request, reply) => {
    const teamKeyId = request.teamKeyId;
    return handleProxy(request.body as CompletionsBody, reply, teamKeyId, request.headers as Record<string, unknown>, request.team);
  });

  // Anthropic Messages API (Phase 6.2) — unlocks Claude Code and the Anthropic SDKs.
  // The request is translated to the canonical OpenAI shape and run through the exact
  // same pipeline as /v1/chat/completions; a wrapper reply translates the OpenAI
  // response (streaming or not) back to Anthropic on the wire. No second routing path.
  fastify.post('/v1/messages', { preHandler: [verifyApiKey] }, async (request, reply) => {
    const openaiBody = anthropicToOpenAI(request.body as Record<string, unknown>) as unknown as CompletionsBody;
    const { reply: anthropicReply } = createAnthropicReply(reply);
    return handleProxy(openaiBody, anthropicReply, request.teamKeyId, request.headers as Record<string, unknown>, request.team);
  });

  // Embeddings (Phase 6.3) — unlocks RAG stacks (LangChain, LlamaIndex, …). Routed to a
  // model that declares the `embedding` capability, through the same resilience path.
  fastify.post('/v1/embeddings', { preHandler: [verifyApiKey] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    return dispatchProxy(body, reply, {
      capability: 'embedding', upstreamPath: '/embeddings', reserveTokens: embeddingReserve(body),
      team: request.team, teamKeyId: request.teamKeyId,
    });
  });

  // Legacy completions (Phase 6.3) — the fill-in-the-middle / autocomplete endpoint,
  // served by a model that declares the `completion` capability. One-shot (non-stream).
  fastify.post('/v1/completions', { preHandler: [verifyApiKey] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    return dispatchProxy(body, reply, {
      capability: 'completion', upstreamPath: '/completions', reserveTokens: completionReserve(body),
      team: request.team, teamKeyId: request.teamKeyId,
    });
  });

  // Image generation (Phase 6.3b) — served by a model that declares the `image`
  // capability. JSON in, JSON out, but billed per generated image rather than per token:
  // the dispatcher records the returned `data[]` count against the model's per-image
  // price. Same routing, breaker, budget and BYOK path as every other endpoint.
  fastify.post('/v1/images/generations', { preHandler: [verifyApiKey] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    return dispatchProxy(body, reply, {
      capability: 'image', upstreamPath: '/images/generations', reserveTokens: imageReserve(body),
      billing: {
        unit: 'image',
        quantityFromResponse: imageQuantity,
        quantityFromRequest: (b) => (typeof b.n === 'number' ? b.n : 1),
      },
      team: request.team, teamKeyId: request.teamKeyId,
    });
  });

  // Model discovery. Returned as a superset that satisfies both an OpenAI client
  // (reads `object`/`data[].id`) and an Anthropic one such as Claude Code (reads
  // `data[].id`/`display_name` and the pagination fields), so one route serves both.
  fastify.get('/v1/models', { preHandler: [verifyApiKey] }, async (_request, reply) => {
    const now = Math.floor(Date.now() / 1000);
    return reply.send({
      object: 'list',
      data: [{
        id:           'alayra-nexus-1',
        object:       'model',
        type:         'model',
        created:      now,
        created_at:   new Date().toISOString(),
        owned_by:     'alayra-nexus',
        display_name: 'Alayra Nexus',
      }],
      has_more: false,
      first_id: 'alayra-nexus-1',
      last_id:  'alayra-nexus-1',
    });
  });
}
