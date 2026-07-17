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

import { test, expect } from '@playwright/test';
import { Gateway } from '../../helpers/api';
import { stack } from '../../setup/stacks';
import { API_OWNER as OWNER } from '../../helpers/personas';

// Sessions & devices (P7.13b): every sign-in leaves a session a person can SEE and KILL.
// The story: sign in from two "devices" (user agents), watch both appear with honest
// descriptions, revoke one and watch it die on its next request, then sign out everywhere
// else and count the survivors.
test.describe.configure({ mode: 'serial' });

const gw = new Gateway(stack('api').baseURL);

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

interface SessionRow {
  id: string; browser: string; userAgent: string; ip: string | null;
  createdAt: number; lastSeenAt: number; current: boolean;
}

let chromeToken = '';
let safariToken = '';

async function loginAs(ua: string): Promise<string> {
  const res = await gw.post<{ token?: string }>('/admin/login', {
    body: { email: OWNER.email, password: OWNER.password },
    headers: { 'User-Agent': ua },
  });
  expect(res.status).toBe(200);
  return res.body.token!;
}

const listSessions = async (token: string) =>
  (await gw.get<{ sessions: SessionRow[] }>('/admin/me/sessions', token)).body.sessions;

test.beforeAll(async () => {
  chromeToken = await loginAs(CHROME_UA);
  safariToken = await loginAs(SAFARI_UA);
});

test('every sign-in is a listed session, described in words a person recognises', async () => {
  const sessions = await listSessions(chromeToken);

  const chrome = sessions.find((s) => s.current);
  const safari = sessions.find((s) => s.userAgent === SAFARI_UA);
  expect(chrome, 'the asking session must mark itself current').toBeTruthy();
  expect(chrome!.browser).toBe('Chrome on Windows');
  expect(safari, 'the other device must be listed too').toBeTruthy();
  expect(safari!.browser).toBe('Safari on macOS');
  expect(safari!.current).toBe(false);

  // The id names the session without BEING it: presenting an id as a bearer token gets nothing.
  const idAsToken = await gw.get('/admin/me', chrome!.id);
  expect(idAsToken.status).toBe(401);
});

test('revoking a session kills it on its very next request', async () => {
  const sessions = await listSessions(chromeToken);
  const safari = sessions.find((s) => s.userAgent === SAFARI_UA)!;

  const revoke = await gw.send('DELETE', `/admin/me/sessions/${safari.id}`, { token: chromeToken });
  expect(revoke.status).toBe(200);

  // Not at expiry, not on the next poll — the very next request.
  expect((await gw.get('/admin/me', safariToken)).status).toBe(401);
  expect((await gw.get('/admin/me', chromeToken)).status).toBe(200);

  // Revoking it again answers exactly like an id that never existed.
  const again = await gw.send('DELETE', `/admin/me/sessions/${safari.id}`, { token: chromeToken });
  expect(again.status).toBe(404);
});

test('sign out everywhere else leaves only the session that asked', async () => {
  await loginAs(SAFARI_UA);
  await loginAs('curl/8.0');

  const res = await gw.post<{ revoked: number }>('/admin/me/sessions/revoke-others', { token: chromeToken });
  expect(res.status).toBe(200);
  expect(res.body.revoked).toBeGreaterThanOrEqual(2);

  const left = await listSessions(chromeToken);
  expect(left).toHaveLength(1);
  expect(left[0].current).toBe(true);
});

test('a token-minted session has no sessions to manage, and is told so plainly', async () => {
  // An admin API token is a credential, not a person: no per-user index behind it.
  const minted = await gw.post<{ token: { token: string } }>('/admin/tokens', {
    token: chromeToken, body: { name: 'sessions-spec', role: 'owner' },
  });
  expect(minted.status).toBe(201);
  const apiToken = minted.body.token.token;

  const res = await gw.get('/admin/me/sessions', apiToken);
  expect(res.status).toBe(400);

  // Leave the stack as this spec found it.
  const rows = await gw.get<{ tokens: { id: string; name: string }[] }>('/admin/tokens', chromeToken);
  const mine = rows.body.tokens.find((t) => t.name === 'sessions-spec')!;
  await gw.send('DELETE', `/admin/tokens/${mine.id}`, { token: chromeToken });
});
