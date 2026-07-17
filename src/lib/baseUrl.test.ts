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

import { describe, it, expect } from 'vitest';
import { buildBaseUrl, buildOrigin } from './baseUrl';

describe('buildOrigin', () => {
  it('is the scheme+host with no /v1 suffix', () => {
    expect(buildOrigin({ host: 'localhost:3000' })).toBe('http://localhost:3000');
  });
  it('honours forwarded proto and host behind a proxy — the externally-reachable origin', () => {
    expect(buildOrigin({ host: 'nexus:3000', forwardedProto: 'https', forwardedHost: 'gateway.acme.com' }))
      .toBe('https://gateway.acme.com');
  });
});

describe('buildBaseUrl', () => {
  // The regression: Fastify v5's `request.hostname` strips the port, so the dashboard
  // handed out `http://localhost/v1` and every client failed to connect.
  it('keeps the port', () => {
    expect(buildBaseUrl({ host: 'localhost:3000' })).toBe('http://localhost:3000/v1');
  });

  it('omits a port that was never there', () => {
    expect(buildBaseUrl({ host: 'nexus.example.com' })).toBe('http://nexus.example.com/v1');
  });

  it('prefers the forwarded host and proto behind a reverse proxy', () => {
    expect(buildBaseUrl({
      host: 'nexus:3000',
      forwardedProto: 'https',
      forwardedHost:  'gateway.acme.com',
    })).toBe('https://gateway.acme.com/v1');
  });

  it('takes the first entry when a proxy chain sends a list', () => {
    expect(buildBaseUrl({
      host: 'nexus:3000',
      forwardedProto: 'https, http',
      forwardedHost:  'gateway.acme.com, inner-lb',
    })).toBe('https://gateway.acme.com/v1');
  });

  it('handles a header delivered as an array', () => {
    expect(buildBaseUrl({
      host: 'nexus:3000',
      forwardedProto: ['https'],
      forwardedHost:  ['gateway.acme.com'],
    })).toBe('https://gateway.acme.com/v1');
  });

  it('ignores an empty forwarded header rather than producing "://"', () => {
    expect(buildBaseUrl({ host: 'localhost:3000', forwardedProto: '', forwardedHost: '' }))
      .toBe('http://localhost:3000/v1');
  });

  it('preserves an IPv6 literal with its port', () => {
    expect(buildBaseUrl({ host: '[::1]:3000' })).toBe('http://[::1]:3000/v1');
  });
});

// ── P7.14: the PUBLIC_URL pin and its provenance ────────────────────────────────

import { normalizePublicUrl, resolvePublicOrigin } from './baseUrl';
import { beforeEach, afterEach, vi } from 'vitest';

describe('normalizePublicUrl', () => {
  it('accepts a clean origin and returns it bare', () => {
    expect(normalizePublicUrl('https://gateway.acme.com')).toBe('https://gateway.acme.com');
  });

  it('keeps a non-default port — dropping it is the classic broken-client bug', () => {
    expect(normalizePublicUrl('http://10.0.0.5:3000')).toBe('http://10.0.0.5:3000');
  });

  it.each([
    ['https://gateway.acme.com/',   'a trailing slash'],
    ['https://gateway.acme.com/v1', 'an included /v1 — people paste the Connect value'],
    ['https://gateway.acme.com/v1/', 'a /v1 with trailing slash'],
    ['  https://gateway.acme.com ', 'surrounding whitespace'],
  ])('forgives %s (%s)', (raw) => {
    expect(normalizePublicUrl(raw)).toBe('https://gateway.acme.com');
  });

  it.each([
    ['not a url at all'],
    ['ftp://gateway.acme.com'],
    ['https://gateway.acme.com/api'],
    ['https://user:pw@gateway.acme.com'],
    ['https://gateway.acme.com/?x=1'],
  ])('refuses %s with a reason instead of misprinting every URL', (raw) => {
    expect(() => normalizePublicUrl(raw)).toThrow(/PUBLIC_URL/);
  });
});

describe('resolvePublicOrigin — who gets to say what the public address is', () => {
  const req = { host: 'nexus:3000', forwardedProto: 'https', forwardedHost: 'gateway.acme.com' };

  beforeEach(() => vi.stubEnv('PUBLIC_URL', ''));
  afterEach(() => vi.unstubAllEnvs());

  it('the operator pin wins over everything, and says so', () => {
    vi.stubEnv('PUBLIC_URL', 'https://pinned.acme.com/v1');
    expect(resolvePublicOrigin(req)).toEqual({ origin: 'https://pinned.acme.com', source: 'env' });
  });

  it('proxy headers speak when there is no pin', () => {
    expect(resolvePublicOrigin(req)).toEqual({ origin: 'https://gateway.acme.com', source: 'proxy' });
  });

  it('a bare Host header is the last resort, and admits it', () => {
    // This is the known hole: no pin, no forwarded headers — scheme is an http guess.
    expect(resolvePublicOrigin({ host: 'localhost:3000' }))
      .toEqual({ origin: 'http://localhost:3000', source: 'host' });
  });
});
