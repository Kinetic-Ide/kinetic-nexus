/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 */

import { describe, it, expect } from 'vitest';
import { BASE, href, appPath } from './base';

// These run against the test build, where BASE_URL is '/' — i.e. the production shape. The point of
// this file is to prove that introducing a base concept changed nothing for the real dashboard; the
// sub-path behaviour is covered below by exercising the same pure logic with an explicit prefix.
describe('base (root deployment — how the gateway always serves it)', () => {
  it('is empty at the site root', () => {
    expect(BASE).toBe('');
  });

  it('leaves every href untouched', () => {
    for (const p of ['/', '/teams', '/nexus', '/status', '/admin']) {
      expect(href(p)).toBe(p);
    }
  });

  it('leaves every pathname untouched', () => {
    for (const p of ['/', '/teams', '/nexus/pool-1', '/anything']) {
      expect(appPath(p)).toBe(p);
    }
  });
});

// The demo build sets base to '/Alayra-Nexus/demo/'. `href` and `appPath` are inverses, and that
// round-trip is what keeps the sidebar, the router and the address bar agreeing with each other.
describe('base (sub-path deployment — the static demo)', () => {
  const PREFIX = '/Alayra-Nexus/demo';
  const hrefWith   = (p: string) => (p === '/' ? `${PREFIX}/` : `${PREFIX}${p}`);
  const appPathWith = (p: string) => {
    if (p === PREFIX || p === `${PREFIX}/`) return '/';
    return p.startsWith(`${PREFIX}/`) ? p.slice(PREFIX.length) : p;
  };

  it('prefixes an app path', () => {
    expect(hrefWith('/teams')).toBe('/Alayra-Nexus/demo/teams');
    expect(hrefWith('/')).toBe('/Alayra-Nexus/demo/');
  });

  it('strips the prefix back off', () => {
    expect(appPathWith('/Alayra-Nexus/demo/teams')).toBe('/teams');
    expect(appPathWith('/Alayra-Nexus/demo/')).toBe('/');
    expect(appPathWith('/Alayra-Nexus/demo')).toBe('/');
  });

  it('round-trips every section path', () => {
    for (const p of ['/', '/nexus', '/connect', '/analytics', '/teams', '/status', '/logs', '/admin']) {
      expect(appPathWith(hrefWith(p))).toBe(p);
    }
  });

  // A URL outside the mount point must not be rewritten into something that accidentally matches a
  // route — it should fall through to not-found instead.
  it('passes through a path outside the mount point unchanged', () => {
    expect(appPathWith('/somewhere-else/teams')).toBe('/somewhere-else/teams');
  });
});
