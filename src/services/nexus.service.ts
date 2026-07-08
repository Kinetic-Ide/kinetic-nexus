import { prisma }           from '../lib/prisma';
import { decrypt, maskKey } from '../lib/encryption';
import { admitKey }         from '../lib/admission';

export { maskKey };

export type Tier = 'premium' | 'standard' | 'fast';

export const TIER_ORDER: Tier[] = ['premium', 'standard', 'fast'];

export interface NexusRoute {
  keyId:        string;
  decryptedKey: string;
  baseUrl:      string;
  modelString:  string;
  providerSlug: string;
  tier:         Tier;
  authHeader:   string;
  authPrefix:   string | null;
  wasDowngrade: boolean;
}

export function providerDefaultUrl(provider: string): string {
  switch (provider) {
    case 'openai':     return 'https://api.openai.com/v1';
    case 'anthropic':  return 'https://api.anthropic.com/v1';
    case 'google':     return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'groq':       return 'https://api.groq.com/openai/v1';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    default:           return '';
  }
}

async function tryPickKey(providerRow: {
  id: string; baseUrl: string | null; provider: string;
  authHeader: string; authPrefix: string | null; tier: string; preferredModel: string | null;
}, reserveTokens: number): Promise<Omit<NexusRoute, 'wasDowngrade'> | null> {
  if (!providerRow.preferredModel) return null;

  const now  = new Date();
  const keys = await prisma.nexusKey.findMany({
    where: {
      providerId: providerRow.id,
      status:     'active',
      OR: [{ coolingUntil: null }, { coolingUntil: { lte: now } }],
    },
    orderBy: { lastUsedAt: 'asc' },
  });

  for (const key of keys) {
    // Atomic RPM + TPM admission. A key at either limit is skipped so the loop
    // rotates to the next key/tier; the caller only fails once every key is
    // exhausted (rotate first, fail last).
    const admitted = await admitKey(key.id, key.rpmLimit, key.tpmLimit, reserveTokens);
    if (!admitted) continue;

    await prisma.nexusKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });

    return {
      keyId:        key.id,
      decryptedKey: decrypt(key.encryptedKey),
      baseUrl:      providerRow.baseUrl ?? providerDefaultUrl(providerRow.provider),
      modelString:  providerRow.preferredModel,
      providerSlug: providerRow.provider,
      tier:         providerRow.tier as Tier,
      authHeader:   providerRow.authHeader,
      authPrefix:   providerRow.authPrefix,
    };
  }
  return null;
}

/**
 * Find the best available key across tiers, atomically reserving `reserveTokens`
 * (estimated input + max output) against the chosen key's TPM budget. Returns
 * null only when every active key is out of RPM or TPM headroom.
 */
export async function discoverBestPool(reserveTokens: number): Promise<NexusRoute | null> {
  let preferredTierFound = false;

  for (const tier of TIER_ORDER) {
    const providers = await prisma.nexusProvider.findMany({
      where:   { isActive: true, tier },
      orderBy: { createdAt: 'asc' },
    });

    for (const provider of providers) {
      if (!preferredTierFound) preferredTierFound = true;
      const route = await tryPickKey(provider, reserveTokens);
      if (route) {
        const wasDowngrade = TIER_ORDER.indexOf(tier) > 0 && preferredTierFound;
        return { ...route, wasDowngrade };
      }
    }
  }
  return null;
}

export async function getNextCooldownSeconds(): Promise<number> {
  const cooling = await prisma.nexusKey.findFirst({
    where:   { status: 'cooling', coolingUntil: { not: null } },
    orderBy: { coolingUntil: 'asc' },
  });
  if (!cooling?.coolingUntil) return 60;
  return Math.max(5, Math.ceil((cooling.coolingUntil.getTime() - Date.now()) / 1000));
}

export async function banKey(keyId: string): Promise<void> {
  await prisma.nexusKey.update({ where: { id: keyId }, data: { status: 'banned' } });
}

export async function coolKey(keyId: string, seconds = 60): Promise<void> {
  const until = new Date(Date.now() + seconds * 1000);
  await prisma.nexusKey.update({ where: { id: keyId }, data: { status: 'cooling', coolingUntil: until } });
}

export async function testKey(keyId: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const key = await prisma.nexusKey.findUnique({
    where:   { id: keyId },
    include: { provider: true },
  });
  if (!key) return { success: false, error: 'Key not found' };

  const apiKey  = decrypt(key.encryptedKey);
  const baseUrl = key.provider.baseUrl ?? providerDefaultUrl(key.provider.provider);
  const start   = Date.now();

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { [key.provider.authHeader]: `${key.provider.authPrefix ?? 'Bearer'} ${apiKey}` },
      signal:  AbortSignal.timeout(5000),
    });
    return { success: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function validateProviderCredentials(
  provider: string,
  baseUrl: string | null,
  apiKey: string,
  authHeader: string,
  authPrefix: string | null,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const url   = `${(baseUrl ?? providerDefaultUrl(provider)).replace(/\/+$/, '')}/models`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { [authHeader]: `${authPrefix ?? 'Bearer'} ${apiKey}` },
      signal:  AbortSignal.timeout(8000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export async function validateModel(
  providerId: string,
  modelName: string,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const provider = await prisma.nexusProvider.findUnique({
    where:   { id: providerId },
    include: { keys: { take: 1, where: { status: 'active' }, orderBy: { lastUsedAt: 'asc' } } },
  });
  if (!provider)              return { ok: false, latencyMs: 0, error: 'Provider not found' };
  if (!provider.keys.length)  return { ok: false, latencyMs: 0, error: 'No active key for this provider — add a key first' };

  const apiKey  = decrypt(provider.keys[0].encryptedKey);
  const baseUrl = (provider.baseUrl ?? providerDefaultUrl(provider.provider)).replace(/\/+$/, '');
  const start   = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        [provider.authHeader]: `${provider.authPrefix ?? 'Bearer'} ${apiKey}`,
      },
      body:   JSON.stringify({ model: modelName, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) return { ok: true, latencyMs };
    const errText = await res.text().catch(() => '');
    return { ok: false, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 120)}` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Request failed' };
  }
}
