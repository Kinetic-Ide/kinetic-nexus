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

// Synthetic gateway data, generated rather than recorded.
//
// A gateway that has served three requests photographs badly: every chart is one spike on a flat
// line and every headline figure reads zero, which says "nothing uses this" about software that
// routes 344-model catalogues. This produces a plausible month of traffic for the screenshots in
// the README, and — because it is a pure function of a seed — the same dataset can be frozen into
// the public demo's fixtures. One generator, so the demo shows what the screenshots show.
//
// Everything here is deliberately deterministic. `Math.random()` and `Date.now()` appear nowhere:
// the caller passes a seed and an anchor time, so two runs a week apart produce byte-identical
// output and a fixture file only changes when someone means it to. That is also what makes the
// generator testable at all — you cannot assert on a shape that reshuffles every call.

// ── Deterministic randomness ──────────────────────────────────────────────────

/**
 * mulberry32: a small, fast, well-distributed PRNG. Chosen over an LCG because the low bits of a
 * naive LCG are famously non-random, and the low bits are exactly what integer bucketing uses.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random source with the few shapes this generator actually needs. */
interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Roughly normal via the mean of three uniforms — enough for plausible spread, no library. */
  around(centre: number, spreadFraction: number): number;
}

function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    chance: (p) => next() < p,
    around: (centre, spreadFraction) => {
      const mean = (next() + next() + next()) / 3;        // centred on 0.5, tapering at the edges
      return centre * (1 + (mean - 0.5) * 2 * spreadFraction);
    },
  };
}

// ── The catalogue the synthetic traffic is drawn from ──────────────────────────

/**
 * Real model ids at real list prices (USD per 1M tokens), so the cost column survives scrutiny —
 * a reader who knows what Sonnet costs should be able to check the arithmetic. `weight` is the
 * share of traffic the model attracts; cheap fast models carry most of it, exactly as they do in a
 * real deployment.
 */
export interface SeedModel {
  id:              string;
  displayName:     string;
  provider:        string;
  tier:            'premium' | 'standard' | 'fast';
  inputCostPer1M:  number;
  outputCostPer1M: number;
  weight:          number;
}

export const SEED_MODELS: readonly SeedModel[] = [
  { id: 'claude-sonnet-4-5',        displayName: 'Claude Sonnet 4.5',     provider: 'anthropic',  tier: 'premium',  inputCostPer1M: 3,    outputCostPer1M: 15,   weight: 20 },
  { id: 'claude-opus-4-1',          displayName: 'Claude Opus 4.1',       provider: 'anthropic',  tier: 'premium',  inputCostPer1M: 15,   outputCostPer1M: 75,   weight: 4  },
  { id: 'claude-haiku-4-5',         displayName: 'Claude Haiku 4.5',      provider: 'anthropic',  tier: 'fast',     inputCostPer1M: 1,    outputCostPer1M: 5,    weight: 14 },
  { id: 'gpt-4o',                   displayName: 'GPT-4o',                provider: 'openai',     tier: 'premium',  inputCostPer1M: 2.5,  outputCostPer1M: 10,   weight: 12 },
  { id: 'gpt-4o-mini',              displayName: 'GPT-4o mini',           provider: 'openai',     tier: 'fast',     inputCostPer1M: 0.15, outputCostPer1M: 0.6,  weight: 22 },
  { id: 'o3-mini',                  displayName: 'o3-mini',               provider: 'openai',     tier: 'standard', inputCostPer1M: 1.1,  outputCostPer1M: 4.4,  weight: 6  },
  { id: 'gemini-2.0-flash',         displayName: 'Gemini 2.0 Flash',      provider: 'google',     tier: 'fast',     inputCostPer1M: 0.1,  outputCostPer1M: 0.4,  weight: 10 },
  { id: 'gemini-1.5-pro',           displayName: 'Gemini 1.5 Pro',        provider: 'google',     tier: 'standard', inputCostPer1M: 1.25, outputCostPer1M: 5,    weight: 5  },
  { id: 'llama-3.3-70b-versatile',  displayName: 'Llama 3.3 70B',         provider: 'groq',       tier: 'fast',     inputCostPer1M: 0.59, outputCostPer1M: 0.79, weight: 5  },
  { id: 'deepseek/deepseek-chat',   displayName: 'DeepSeek Chat',         provider: 'openrouter', tier: 'standard', inputCostPer1M: 0.14, outputCostPer1M: 0.28, weight: 2  },
];

/** Teams, sized so the leaderboard has an obvious top and a plausible tail. */
export interface SeedTeam {
  name:             string;
  budgetUsd:        number | null;
  budgetPeriod:     'daily' | 'weekly' | 'monthly';
  overBudgetAction: 'block' | 'notify' | 'downgrade';
  /** Share of total traffic attributed to this team. */
  weight:           number;
  keyNames:         readonly string[];
}

export const SEED_TEAMS: readonly SeedTeam[] = [
  { name: 'Platform Engineering', budgetUsd: 2500, budgetPeriod: 'monthly', overBudgetAction: 'block',     weight: 34, keyNames: ['platform-prod', 'platform-staging'] },
  { name: 'Customer Support AI',  budgetUsd: 1200, budgetPeriod: 'monthly', overBudgetAction: 'downgrade', weight: 26, keyNames: ['support-bot', 'support-analytics'] },
  { name: 'Data Science',         budgetUsd: 900,  budgetPeriod: 'monthly', overBudgetAction: 'notify',    weight: 18, keyNames: ['research-notebooks'] },
  { name: 'Mobile App',           budgetUsd: 600,  budgetPeriod: 'monthly', overBudgetAction: 'block',     weight: 14, keyNames: ['ios-prod', 'android-prod'] },
  { name: 'Internal Tools',       budgetUsd: null, budgetPeriod: 'monthly', overBudgetAction: 'notify',    weight: 8,  keyNames: ['internal-scripts'] },
];

/** The people who appear in the audit trail. */
export const SEED_ACTORS: readonly { name: string; role: 'owner' | 'admin' | 'viewer' }[] = [
  { name: 'Abbas Baber',   role: 'owner'  },
  { name: 'Liaqat Ali',    role: 'admin'  },
  { name: 'Sana Malik',    role: 'admin'  },
  { name: 'Usman Tariq',   role: 'viewer' },
];

/**
 * Outcomes in the proportions a healthy gateway actually produces: overwhelmingly successful, a
 * thin band of client errors, and rarer upstream trouble. Seeding 100% success would be a nicer
 * screenshot and a dishonest one — the reliability panel exists precisely to show this band.
 */
const OUTCOMES: readonly { outcome: string; weight: number }[] = [
  { outcome: 'success',        weight: 955 },
  { outcome: 'client_error',   weight: 22  },
  { outcome: 'upstream_error', weight: 12  },
  { outcome: 'no_capacity',    weight: 6   },
  { outcome: 'budget_blocked', weight: 3   },
  { outcome: 'blocked',        weight: 2   },
];

// ── Output shapes ─────────────────────────────────────────────────────────────

export interface GeneratedUsage {
  sessionId:    string;
  modelId:      string;
  modelName:    string;
  provider:     string;
  inputTokens:  number;
  outputTokens: number;
  totalTokens:  number;
  estimatedUsd: number;
  outcome:      string;
  latencyMs:    number;
  cached:       boolean;
  savedUsd:     number;
  teamKeyName:  string;   // resolved to an id by the writer
  createdAt:    Date;
}

export interface GeneratedAudit {
  action:    string;
  method:    string;
  actorRole: string;
  actorName: string;
  target:    string | null;
  status:    number;
  createdAt: Date;
}

export interface GeneratedNotification {
  type:      string;
  severity:  'critical' | 'warning' | 'info';
  title:     string;
  body:      string;
  section:   string | null;
  dedupeKey: string;
  readAt:    Date | null;
  createdAt: Date;
}

export interface GeneratedData {
  teams:         readonly SeedTeam[];
  models:        readonly SeedModel[];
  usage:         GeneratedUsage[];
  audit:         GeneratedAudit[];
  notifications: GeneratedNotification[];
}

export interface GenerateOptions {
  /** Anchor for "now". Every record is placed relative to this, never to the wall clock. */
  now:   Date;
  /** How many days of history to produce. */
  days:  number;
  /** Fixed seed — the same seed always yields the same dataset. */
  seed:  number;
  /** Approximate requests per day at the busiest point of the week. */
  peakRequestsPerDay: number;
}

// ── Generation ────────────────────────────────────────────────────────────────

/** Pick from a weighted list. */
function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng.next() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Traffic shape. Weekdays carry roughly three times a weekend, and the day has a working-hours
 * hump — a flat distribution reads as fabricated the moment anyone looks at an hourly chart.
 */
function dayVolumeFactor(date: Date): number {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return 0.32;             // Sunday / Saturday
  if (day === 5) return 0.78;                          // Friday tails off
  return 1;
}

function hourVolumeFactor(hour: number): number {
  if (hour < 6)  return 0.15;
  if (hour < 9)  return 0.55;
  if (hour < 12) return 1;
  if (hour < 14) return 0.8;                           // lunch dip
  if (hour < 18) return 1;
  if (hour < 21) return 0.6;
  return 0.3;
}

/** Cost in USD for a token count at a per-1M rate, rounded to a sane number of decimals. */
function costUsd(tokens: number, per1M: number): number {
  return Math.round((tokens / 1_000_000) * per1M * 1e6) / 1e6;
}

function generateUsage(rng: Rng, opts: GenerateOptions): GeneratedUsage[] {
  const rows: GeneratedUsage[] = [];
  const keyPool = SEED_TEAMS.flatMap((t) => t.keyNames.map((name) => ({ name, weight: t.weight / t.keyNames.length })));

  for (let dayOffset = opts.days - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(opts.now);
    dayStart.setUTCDate(dayStart.getUTCDate() - dayOffset);
    dayStart.setUTCHours(0, 0, 0, 0);

    // A gentle upward trend across the window, so the charts show adoption rather than noise.
    const growth = 0.62 + (0.38 * (opts.days - dayOffset)) / opts.days;
    const dayTarget = Math.round(rng.around(opts.peakRequestsPerDay * dayVolumeFactor(dayStart) * growth, 0.18));

    for (let hour = 0; hour < 24; hour++) {
      // Today is only partly over. Filling all 24 hours on the final day would place requests in
      // the future — visibly wrong on a dashboard, and the kind of detail that makes a screenshot
      // read as fabricated the moment anyone checks the clock.
      if (dayOffset === 0 && hour > opts.now.getUTCHours()) break;

      const hourTarget = Math.round(dayTarget * hourVolumeFactor(hour) / 12);
      for (let i = 0; i < hourTarget; i++) {
        const model   = weightedPick(rng, SEED_MODELS);
        const outcome = weightedPick(rng, OUTCOMES).outcome;
        const key     = weightedPick(rng, keyPool);

        const createdAt = new Date(dayStart);
        createdAt.setUTCHours(hour, rng.int(0, 59), rng.int(0, 59), 0);
        // The current hour is itself only partly elapsed; clamp so nothing lands past `now`.
        if (createdAt.getTime() > opts.now.getTime()) continue;

        // A failed request bought nothing: no tokens, no cost. This mirrors what the proxy
        // actually records, and it is why the money columns stay honest under an error spike.
        if (outcome !== 'success') {
          rows.push({
            sessionId: `sess_${rng.int(1, 400)}`,
            modelId: model.id, modelName: model.displayName, provider: model.provider,
            inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedUsd: 0,
            outcome, latencyMs: rng.int(40, 900), cached: false, savedUsd: 0,
            teamKeyName: key.name, createdAt,
          });
          continue;
        }

        const inputTokens  = Math.max(24, Math.round(rng.around(1180, 0.85)));
        const outputTokens = Math.max(8,  Math.round(rng.around(430, 0.9)));
        const cached       = rng.chance(0.14);

        const fullCost = costUsd(inputTokens, model.inputCostPer1M) + costUsd(outputTokens, model.outputCostPer1M);

        rows.push({
          sessionId: `sess_${rng.int(1, 400)}`,
          modelId: model.id, modelName: model.displayName, provider: model.provider,
          inputTokens, outputTokens, totalTokens: inputTokens + outputTokens,
          // A cache hit called no provider, so it cost nothing and saved what it would have cost.
          estimatedUsd: cached ? 0 : fullCost,
          outcome,
          latencyMs: cached ? rng.int(6, 40) : rng.int(320, 4200),
          cached,
          savedUsd: cached ? fullCost : 0,
          teamKeyName: key.name, createdAt,
        });
      }
    }
  }
  return rows;
}

/**
 * `writes` marks an action a read-only viewer cannot perform. The gateway enforces exactly this —
 * viewers are shown no write controls and the server guards refuse them anyway — so an audit trail
 * showing a viewer deleting a model would contradict the product's own security model in a
 * screenshot. Sign-in and sign-out are the only things every role does.
 */
const AUDIT_ACTIONS: readonly { action: string; method: string; status: number; weight: number; writes: boolean }[] = [
  { action: 'auth.login',            method: 'POST',   status: 200, weight: 26, writes: false },
  { action: 'auth.logout',           method: 'POST',   status: 200, weight: 10, writes: false },
  { action: 'keys.create',           method: 'POST',   status: 201, weight: 8,  writes: true  },
  { action: 'keys.update',           method: 'PATCH',  status: 200, weight: 9,  writes: true  },
  { action: 'keys.delete',           method: 'DELETE', status: 200, weight: 4,  writes: true  },
  { action: 'teams.create',          method: 'POST',   status: 201, weight: 5,  writes: true  },
  { action: 'teams.update',          method: 'PATCH',  status: 200, weight: 8,  writes: true  },
  { action: 'models.update',         method: 'PUT',    status: 200, weight: 7,  writes: true  },
  { action: 'models.delete',         method: 'DELETE', status: 200, weight: 3,  writes: true  },
  { action: 'providers.create',      method: 'POST',   status: 201, weight: 4,  writes: true  },
  { action: 'providers.fetch-models',method: 'POST',   status: 200, weight: 6,  writes: true  },
  { action: 'settings.update',       method: 'PATCH',  status: 200, weight: 5,  writes: true  },
  { action: 'auth.login',            method: 'POST',   status: 401, weight: 3,  writes: false },  // the failures matter
  // Revealing a team key's plaintext is write-guarded on the server: a copyable credential is not
  // "read-only". Owners only, matching the real guard.
  { action: 'teams.keys.reveal',     method: 'POST',   status: 200, weight: 2,  writes: true  },
];

function generateAudit(rng: Rng, opts: GenerateOptions, count: number): GeneratedAudit[] {
  const rows: GeneratedAudit[] = [];
  for (let i = 0; i < count; i++) {
    const entry = weightedPick(rng, AUDIT_ACTIONS);
    // Draw the actor from the roles that could actually have performed this action.
    const eligible = entry.writes ? SEED_ACTORS.filter((a) => a.role !== 'viewer') : SEED_ACTORS;
    const actor = rng.pick(eligible);
    const createdAt = new Date(opts.now.getTime() - rng.int(0, opts.days * 24 * 60) * 60_000);
    rows.push({
      action: entry.action,
      method: entry.method,
      // A 401 has no authenticated actor to name — the system recorded it, nobody signed it.
      actorRole: entry.status === 401 ? 'system' : actor.role,
      actorName: entry.status === 401 ? '' : actor.name,
      target:    entry.action.includes('.') && rng.chance(0.4) ? `id_${rng.int(1000, 9999)}` : null,
      status:    entry.status,
      createdAt,
    });
  }
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function generateNotifications(rng: Rng, opts: GenerateOptions): GeneratedNotification[] {
  const specs: readonly Omit<GeneratedNotification, 'createdAt' | 'readAt' | 'dedupeKey'>[] = [
    { type: 'budgetThreshold', severity: 'critical', title: 'Mobile App is over budget',            body: 'The team has spent $612.40 of its $600.00 monthly cap. New requests are blocked until the period resets.', section: 'teams' },
    { type: 'keyBanned',       severity: 'critical', title: 'OpenAI key banned after auth failures', body: 'Key sk-••••4f2a returned 401 three times in a row and has been removed from rotation.',                    section: 'nexus' },
    { type: 'budgetThreshold', severity: 'warning',  title: 'Customer Support AI at 82% of budget',  body: 'The team has spent $984.10 of its $1,200.00 monthly cap.',                                                  section: 'teams' },
    { type: 'breakerOpened',   severity: 'warning',  title: 'Circuit breaker opened for Groq',       body: 'Repeated upstream errors; the key is cooling for 5 minutes and traffic has moved to the next tier.',        section: 'health' },
    { type: 'tierExhausted',   severity: 'warning',  title: 'Premium tier exhausted briefly',        body: 'All premium keys were rate limited at 14:20 UTC. Requests fell through to standard.',                       section: 'nexus' },
    { type: 'adminLockout',    severity: 'critical', title: 'Sign-in locked after failed attempts',  body: 'Five failed sign-ins from 203.0.113.44. That source is locked out for 15 minutes.',                          section: 'admin' },
    { type: 'budgetThreshold', severity: 'info',     title: 'Data Science reached 50% of budget',    body: 'The team has spent $451.90 of its $900.00 monthly cap.',                                                     section: 'teams' },
    { type: 'breakerOpened',   severity: 'info',     title: 'Breaker recovered for OpenRouter',      body: 'The half-open probe succeeded and the key is back in rotation.',                                            section: 'health' },
  ];

  return specs.map((spec, i) => {
    const createdAt = new Date(opts.now.getTime() - rng.int(20, 60 * 74) * 60_000);
    return {
      ...spec,
      dedupeKey: `seed:${spec.type}:${i}`,
      // The newest few stay unread so the bell carries a badge — including a critical one, which is
      // what makes the red count and the severity tinting visible in a screenshot at all.
      readAt: i < 3 ? null : new Date(createdAt.getTime() + 30 * 60_000),
      createdAt,
    };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Produce a full synthetic dataset. Pure: same options in, same data out, no clock and no global
 * random state touched.
 */
export function generate(opts: GenerateOptions): GeneratedData {
  const rng = makeRng(opts.seed);
  return {
    teams:         SEED_TEAMS,
    models:        SEED_MODELS,
    usage:         generateUsage(rng, opts),
    audit:         generateAudit(rng, opts, 140),
    notifications: generateNotifications(rng, opts),
  };
}

/** Headline totals, used by the writer's report and by the fixture builder. */
export function summarise(data: GeneratedData) {
  const successful = data.usage.filter((u) => u.outcome === 'success');
  return {
    requests:     data.usage.length,
    successful:   successful.length,
    inputTokens:  successful.reduce((n, u) => n + u.inputTokens, 0),
    outputTokens: successful.reduce((n, u) => n + u.outputTokens, 0),
    costUsd:      Math.round(successful.reduce((n, u) => n + u.estimatedUsd, 0) * 100) / 100,
    savedUsd:     Math.round(successful.reduce((n, u) => n + u.savedUsd, 0) * 100) / 100,
    cacheHitRate: successful.length ? successful.filter((u) => u.cached).length / successful.length : 0,
    auditRows:    data.audit.length,
    notifications:data.notifications.length,
  };
}
