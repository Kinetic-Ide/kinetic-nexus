import { describe, it, expect } from 'vitest';
import { lookupPricing, getPricingCatalog } from './pricingCatalog.service';

describe('pricingCatalog', () => {
  it('exposes a non-empty catalog', () => {
    expect(getPricingCatalog().length).toBeGreaterThan(0);
  });

  it('matches an exact model string', () => {
    expect(lookupPricing('gpt-4o')?.inputCostPer1M).toBe(2.5);
  });

  it('prefers the longest prefix (gpt-4o-mini never falls through to gpt-4o)', () => {
    expect(lookupPricing('gpt-4o-mini')?.inputCostPer1M).toBe(0.15);
  });

  it('matches a dated variant by prefix (claude-3-5-sonnet-20241022)', () => {
    const e = lookupPricing('claude-3-5-sonnet-20241022');
    expect(e?.provider).toBe('anthropic');
    expect(e?.outputCostPer1M).toBe(15);
  });

  it('carries per-modality prices where they apply', () => {
    expect(lookupPricing('tts-1')?.speechPricePer1MChars).toBe(15);
    expect(lookupPricing('gpt-4o-realtime-preview')?.audioOutputPer1M).toBe(80);
  });

  it('returns null for an unknown model and blank input', () => {
    expect(lookupPricing('totally-made-up-model')).toBeNull();
    expect(lookupPricing('')).toBeNull();
  });
});
