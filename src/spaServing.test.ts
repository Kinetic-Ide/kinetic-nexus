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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import staticFiles from '@fastify/static';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { isSpaNavigation } from './lib/spaFallback';

// End-to-end proof of the Phase 7.9 static-serving wiring, exercised exactly as server.ts wires it
// (static plugin with wildcard:false + a not-found handler using isSpaNavigation) but against a tiny
// throwaway dist so it needs neither a database nor the real web build. It verifies the two things the
// cutover has to get right: real files are served, and a deep-link refresh gets index.html rather than
// a 404 — while API 404s stay JSON.

const HTML = 'text/html,application/xhtml+xml';
let app: FastifyInstance;
let dist: string;

beforeAll(async () => {
  dist = mkdtempSync(path.join(tmpdir(), 'nexus-dist-'));
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="app">NEXUS_SPA_ROOT</div>');
  writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log("nexus-bundle");');

  app = Fastify();
  await app.register(staticFiles, { root: dist, prefix: '/', wildcard: false });
  // A stand-in for a real API route, to prove existing routes are untouched by the fallback.
  app.get('/v1/models', async () => ({ data: [] }));
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0];
    if (isSpaNavigation(request.method, request.headers.accept, pathname)) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: `Route ${request.method} ${pathname} not found` });
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(dist, { recursive: true, force: true });
});

describe('static serving + SPA fallback', () => {
  it('serves index.html at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/', headers: { accept: HTML } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('NEXUS_SPA_ROOT');
  });

  it('serves a built asset by its real path', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('nexus-bundle');
  });

  it('serves the app (not a 404) for a deep-link refresh', async () => {
    for (const url of ['/teams', '/nexus', '/admin', '/caching']) {
      const res = await app.inject({ method: 'GET', url, headers: { accept: HTML } });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain('NEXUS_SPA_ROOT');
    }
  });

  it('leaves a real API route working, untouched by the fallback', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/models', headers: { accept: 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: [] });
  });

  it('gives an API client a JSON 404, not the dashboard shell', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/does-not-exist', headers: { accept: 'application/json' } });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).not.toContain('NEXUS_SPA_ROOT');
  });

  it('does not serve the shell for an unknown gateway API path even from a browser', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/typo', headers: { accept: HTML } });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('NEXUS_SPA_ROOT');
  });
});
