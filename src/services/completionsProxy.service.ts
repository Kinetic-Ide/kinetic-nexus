import type { FastifyReply } from 'fastify';
import { discoverBestPool, coolKey, getNextCooldownSeconds } from './nexus.service';
import { recordTokenUsage }          from './token.service';
import { computeReserve, countMessageTokens, countTokens } from '../lib/tokenizer';
import { reconcileTpm }              from '../lib/admission';

export interface CompletionsBody {
  model?:       string;
  messages?:    unknown[];
  stream?:      boolean;
  max_tokens?:  number;
  temperature?: number;
  tools?:       unknown[];
  tool_choice?: unknown;
  [key: string]: unknown;
}

export class ProxyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Output tokens to reserve when the caller does not set max_tokens. Reconciliation
// corrects the reservation to real usage once the response completes.
const DEFAULT_MAX_TOKENS_RESERVE = parseInt(process.env.NEXUS_DEFAULT_MAX_TOKENS ?? '2048', 10);
// Time to first byte: upstream must return response headers within this window.
const UPSTREAM_TTFT_MS = parseInt(process.env.UPSTREAM_TTFT_MS ?? '20000', 10);
// Non-streaming: full response body must be read within this window.
const UPSTREAM_BODY_MS = parseInt(process.env.UPSTREAM_BODY_MS ?? '60000', 10);
// Streaming: maximum gap allowed between two chunks (an idle/hung stream is aborted;
// legitimate long streams keep running as long as chunks keep arriving).
const STREAM_IDLE_MS   = parseInt(process.env.UPSTREAM_STREAM_IDLE_MS ?? '30000', 10);

function parseUsageFromSSE(collected: string): { input: number; output: number } | null {
  const lines = collected.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('data:')) continue;
    const json = line.slice(5).trim();
    if (json === '[DONE]') continue;
    try {
      const parsed = JSON.parse(json) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
      if (parsed.usage?.prompt_tokens !== undefined) {
        return { input: parsed.usage.prompt_tokens ?? 0, output: parsed.usage.completion_tokens ?? 0 };
      }
    } catch { /* skip */ }
  }
  return null;
}

function estimateDeltaTokens(collected: string): number {
  const matches = collected.match(/"delta"\s*:\s*\{[^}]*"content"\s*:\s*"([^"]*)"/g) ?? [];
  const content = matches.map(m => { try { return JSON.parse(`{${m}}`).delta?.content ?? ''; } catch { return ''; } }).join('');
  return Math.max(1, countTokens(content));
}

export async function handleProxy(body: CompletionsBody, reply: FastifyReply, teamKeyId?: string): Promise<FastifyReply | void> {
  const modelField = (body.model ?? '').trim().toLowerCase();
  if (modelField && modelField !== 'kinetic-nexus-1' && modelField !== 'nexus') {
    return reply.code(400).send({
      error: `Invalid model "${body.model}". Use model: "kinetic-nexus-1" — Kinetic Nexus routes automatically.`,
    });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const isStream = body.stream === true;
  const reserve  = computeReserve(messages, body.max_tokens, DEFAULT_MAX_TOKENS_RESERVE);

  const route = await discoverBestPool(reserve);
  if (!route) {
    const retryAfter = await getNextCooldownSeconds();
    return reply
      .code(503)
      .header('Retry-After', String(retryAfter))
      .send({
        error: `All API keys are currently rate-limited. Retry in ${retryAfter}s or add more provider keys.`,
        retryAfter,
      });
  }

  const keyId = route.keyId;
  // Release the full token reservation for a request that did not (fully) run.
  // RPM stays consumed on purpose — the request was attempted against the provider.
  const refundReservation = () => { void reconcileTpm(keyId, reserve, 0).catch(() => {}); };

  const upstreamUrl  = `${route.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const upstreamBody = { ...body, model: route.modelString };
  const authValue    = `${route.authPrefix ?? 'Bearer'} ${route.decryptedKey}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [route.authHeader]: authValue,
  };
  const sessionId = `proxy-${Date.now()}`;

  // A single controller governs the whole upstream call. A time-to-first-byte
  // timer aborts if response headers never arrive; it is cleared once they do.
  const controller = new AbortController();
  let ttftTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), UPSTREAM_TTFT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method: 'POST', headers, body: JSON.stringify(upstreamBody), signal: controller.signal });
  } catch (err) {
    if (ttftTimer) clearTimeout(ttftTimer);
    refundReservation();
    const aborted = err instanceof Error && err.name === 'AbortError';
    if (aborted) await coolKey(keyId, 30); // slow to first byte — cool briefly and rotate next time
    return reply.code(504).send({ error: aborted ? 'Upstream timed out before responding.' : 'Upstream connection failed.' });
  }
  if (ttftTimer) { clearTimeout(ttftTimer); ttftTimer = null; }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => 'Upstream error');
    if (upstream.status === 429) await coolKey(keyId, 60);
    refundReservation(); // rejected upstream — return the reserved budget
    return reply.code(upstream.status).send(errText);
  }

  const nexusHeaders = {
    'X-Nexus-Model':          route.modelString,
    'X-Nexus-Provider':       route.providerSlug,
    'X-Nexus-Tier':           route.tier,
    ...(route.wasDowngrade ? { 'X-Nexus-Tier-Downgrade': 'true' } : {}),
  };

  if (isStream && upstream.body) {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type':          'text/event-stream; charset=utf-8',
      'Cache-Control':         'no-cache, no-transform',
      'Connection':            'keep-alive',
      'X-Accel-Buffering':    'no',
      ...nexusHeaders,
    });

    const reader    = upstream.body.getReader();
    const decoder   = new TextDecoder();
    let collected   = '';
    // Idle guard: abort if the gap between chunks exceeds STREAM_IDLE_MS.
    let idleTimer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), STREAM_IDLE_MS);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_MS);
        collected += decoder.decode(value, { stream: true });
        reply.raw.write(value);
      }
    } catch { /* aborted (idle timeout) or upstream error mid-stream — flush what we have */ }
    finally {
      clearTimeout(idleTimer);
      reply.raw.end();
    }

    const usage        = parseUsageFromSSE(collected);
    const inputTokens  = usage?.input  ?? countMessageTokens(messages);
    const outputTokens = usage?.output ?? estimateDeltaTokens(collected);
    void reconcileTpm(keyId, reserve, inputTokens + outputTokens).catch(() => {});
    void recordTokenUsage({ sessionId, modelId: route.modelString, modelName: route.modelString, provider: route.providerSlug, inputTokens, outputTokens, nexusTeamKeyId: teamKeyId }).catch(() => {});
    return;
  }

  // Non-streaming: bound the body read with its own timer.
  let data: Record<string, unknown>;
  const bodyTimer = setTimeout(() => controller.abort(), UPSTREAM_BODY_MS);
  try {
    data = await upstream.json() as Record<string, unknown>;
  } catch {
    clearTimeout(bodyTimer);
    refundReservation();
    return reply.code(504).send({ error: 'Upstream response timed out or was malformed.' });
  }
  clearTimeout(bodyTimer);

  const usageObj     = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  const inputTokens  = usageObj?.prompt_tokens     ?? countMessageTokens(messages);
  const outputTokens = usageObj?.completion_tokens  ?? 1;
  void reconcileTpm(keyId, reserve, inputTokens + outputTokens).catch(() => {});
  void recordTokenUsage({ sessionId, modelId: route.modelString, modelName: route.modelString, provider: route.providerSlug, inputTokens, outputTokens, nexusTeamKeyId: teamKeyId }).catch(() => {});

  for (const [k, v] of Object.entries(nexusHeaders)) reply.header(k, v);
  return reply.code(200).send(data);
}
