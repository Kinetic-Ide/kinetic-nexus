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
import { stack, ADMIN_PASSWORD } from '../../setup/stacks';
import { API_OWNER as OWNER } from '../../helpers/personas';

// The factory reset (P7.13b), 98- on purpose: it destroys everything every earlier spec
// built, so it runs after all of them — and before 99-lockout, which needs only a login
// endpoint to hammer and works identically against the re-claimed gateway this spec
// leaves behind.
//
// The route demands three proofs of different kinds: an owner SESSION, the environment's
// MASTER PASSWORD, and a TYPED PHRASE. Each is tested alone so a failure names the
// missing proof, not just "reset didn't work".
test.describe.configure({ mode: 'serial' });

const gw = new Gateway(stack('api').baseURL);
const PHRASE = 'RESET THIS GATEWAY';

let ownerToken = '';

test.beforeAll(async () => {
  ownerToken = await gw.login(OWNER.email, OWNER.password);
});

test('a viewer credential is refused before the password is even considered', async () => {
  // Mint the least credential the gateway can issue and point it at the biggest trigger.
  const minted = await gw.post<{ token: { token: string } }>('/admin/tokens', {
    token: ownerToken, body: { name: 'reset-probe', role: 'viewer' },
  });
  const viewerToken = minted.body.token.token;

  const res = await gw.post('/admin/setup/reset', {
    token: viewerToken, body: { masterPassword: ADMIN_PASSWORD, confirm: PHRASE },
  });
  expect(res.status).toBe(403);
});

test('the phrase must be typed exactly — near enough is not consent', async () => {
  const res = await gw.post<{ error: string }>('/admin/setup/reset', {
    token: ownerToken, body: { masterPassword: ADMIN_PASSWORD, confirm: 'reset this gateway' },
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain(PHRASE); // the refusal teaches the exact phrase
});

test('an owner session alone is not enough without the install secret', async () => {
  const res = await gw.post('/admin/setup/reset', {
    token: ownerToken, body: { masterPassword: 'not-the-install-secret', confirm: PHRASE },
  });
  expect(res.status).toBe(401);
});

test('all three proofs together erase everything, including the session that asked', async () => {
  const res = await gw.post<{ success: boolean; tablesCleared: number; redisKeysCleared: number }>(
    '/admin/setup/reset',
    { token: ownerToken, body: { masterPassword: ADMIN_PASSWORD, confirm: PHRASE } },
  );
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.tablesCleared).toBeGreaterThan(0);

  // The reset destroyed its own caller: the owner token died with everything else.
  expect((await gw.get('/admin/me', ownerToken)).status).toBe(401);

  // The account is gone too — this is a 401 for bad credentials, not a live sign-in.
  const ghost = await gw.post('/admin/login', { body: { email: OWNER.email, password: OWNER.password } });
  expect(ghost.status).toBe(401);

  // And the gateway is back to its first morning, waiting to be claimed.
  const status = await gw.get<{ unclaimed: boolean }>('/admin/setup/status');
  expect(status.body.unclaimed).toBe(true);
});

test('the wiped gateway can be claimed again with the same install secret', async () => {
  // Un-claiming is claiming's mirror: the environment secret that proved installation the
  // first time proves it again. Re-claiming here also leaves the stack with a working owner
  // for 99-lockout to be locked out AS.
  const res = await gw.post<{ user: { role: string }; token: string }>('/admin/setup/claim', {
    body: { masterPassword: ADMIN_PASSWORD, name: OWNER.name, email: OWNER.email, password: OWNER.password },
  });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('owner');
  expect((await gw.get('/admin/me', res.body.token)).status).toBe(200);
});
