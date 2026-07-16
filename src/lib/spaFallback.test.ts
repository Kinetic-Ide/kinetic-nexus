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
import { isSpaNavigation } from './spaFallback';

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'; // a real browser Accept
const JSON_ACCEPT = 'application/json';

describe('isSpaNavigation', () => {
  it('serves the app for a browser navigation to a client-side route', () => {
    expect(isSpaNavigation('GET', HTML, '/teams')).toBe(true);
    expect(isSpaNavigation('GET', HTML, '/nexus')).toBe(true);
    expect(isSpaNavigation('GET', HTML, '/admin')).toBe(true); // /admin is a dashboard route, not just an API prefix
    expect(isSpaNavigation('HEAD', HTML, '/caching')).toBe(true);
  });

  it('does not hijack API-client requests (they get the real JSON 404)', () => {
    expect(isSpaNavigation('GET', JSON_ACCEPT, '/admin/nonexistent')).toBe(false);
    expect(isSpaNavigation('GET', '*/*', '/admin/teams')).toBe(false); // the dashboard's own fetch sends */*
    expect(isSpaNavigation('GET', undefined, '/teams')).toBe(false);
  });

  it('never serves the app for a non-GET method', () => {
    expect(isSpaNavigation('POST', HTML, '/teams')).toBe(false);
    expect(isSpaNavigation('DELETE', HTML, '/admin/teams/x')).toBe(false);
  });

  it('excludes the gateway API/infra namespaces even from a browser', () => {
    expect(isSpaNavigation('GET', HTML, '/v1/models')).toBe(false);
    expect(isSpaNavigation('GET', HTML, '/v1')).toBe(false);
    expect(isSpaNavigation('GET', HTML, '/health')).toBe(false);
    expect(isSpaNavigation('GET', HTML, '/metrics')).toBe(false);
  });

  it('does not confuse a lookalike path with an excluded namespace', () => {
    // /v1-ish or /healthy are ordinary routes the app may own — only the exact namespaces are excluded.
    expect(isSpaNavigation('GET', HTML, '/v1x')).toBe(true);
    expect(isSpaNavigation('GET', HTML, '/healthcheck')).toBe(true);
  });
});
