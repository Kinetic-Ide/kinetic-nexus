import { describe, it, expect } from 'vitest';
import { describeUserAgent } from './userAgent';

// The one honest job of this string is recognisability on the sessions panel. The traps are
// all containment: Edge and Opera contain "Chrome", Chrome contains "Safari", Android
// contains "Linux" — naive first-match parsing calls everything Chrome on Linux.

const CHROME_WIN  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const EDGE_WIN    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0';
const FIREFOX_LNX = 'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0';
const SAFARI_MAC  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const CHROME_AND  = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

describe('describeUserAgent', () => {
  it('names the common pairs', () => {
    expect(describeUserAgent(CHROME_WIN)).toBe('Chrome on Windows');
    expect(describeUserAgent(FIREFOX_LNX)).toBe('Firefox on Linux');
    expect(describeUserAgent(SAFARI_MAC)).toBe('Safari on macOS');
  });

  it('is not fooled by containment: Edge is not Chrome, Android is not Linux', () => {
    expect(describeUserAgent(EDGE_WIN)).toBe('Edge on Windows');
    expect(describeUserAgent(CHROME_AND)).toBe('Chrome on Android');
  });

  it('names curl — a script holding your session is exactly what the panel is for', () => {
    expect(describeUserAgent('curl/8.5.0')).toBe('curl');
  });

  it('keeps unknowns unknown rather than guessing', () => {
    expect(describeUserAgent('CustomAgent/1.0')).toBe('Unknown device');
    expect(describeUserAgent('')).toBe('Unknown device');
    expect(describeUserAgent(null)).toBe('Unknown device');
    expect(describeUserAgent(undefined)).toBe('Unknown device');
  });
});
