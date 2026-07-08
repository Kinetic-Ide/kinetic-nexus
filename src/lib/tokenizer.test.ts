import { describe, it, expect } from 'vitest';
import { countTokens, countMessageTokens, computeReserve } from './tokenizer';

describe('countTokens', () => {
  it('returns 0 for empty input', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns a positive count for real text', () => {
    expect(countTokens('hello world')).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(countTokens('the quick brown fox')).toBe(countTokens('the quick brown fox'));
  });

  it('counts more tokens for longer text', () => {
    expect(countTokens('a'.repeat(400))).toBeGreaterThan(countTokens('a'));
  });
});

describe('countMessageTokens', () => {
  it('never returns less than 1, even for no messages', () => {
    expect(countMessageTokens([])).toBe(1);
  });

  it('counts string content plus per-message overhead', () => {
    expect(countMessageTokens([{ role: 'user', content: 'hello' }])).toBe(countTokens('hello') + 4);
  });

  it('counts text parts in array content', () => {
    const msgs = [{ role: 'user', content: [{ type: 'text', text: 'hi there' }] }];
    expect(countMessageTokens(msgs)).toBe(countTokens('hi there') + 4);
  });

  it('ignores malformed entries without content', () => {
    expect(countMessageTokens([{ role: 'system' }, null, 42])).toBe(1);
  });
});

describe('computeReserve', () => {
  it('reserves input + explicit max_tokens', () => {
    const input = countMessageTokens([{ role: 'user', content: 'hi' }]);
    expect(computeReserve([{ role: 'user', content: 'hi' }], 100, 2048)).toBe(input + 100);
  });

  it('falls back to the default output reserve when max_tokens is missing', () => {
    expect(computeReserve([], undefined, 2048)).toBe(1 + 2048);
  });

  it('treats a non-positive max_tokens as unset', () => {
    expect(computeReserve([], 0, 2048)).toBe(1 + 2048);
  });
});
