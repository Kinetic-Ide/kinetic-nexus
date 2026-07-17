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
import { stack, API_STACK_PUBLIC_URL } from '../../setup/stacks';
import { API_OWNER as OWNER } from '../../helpers/personas';

// Public URL truth (P7.14), proven at the wire. This stack boots with PUBLIC_URL pinned to an
// address no inference could derive from a loopback request — so every assertion here separates
// "the operator said" from "the gateway guessed".
test.describe.configure({ mode: 'serial' });

const gw = new Gateway(stack('api').baseURL);

let ownerToken = '';

test.beforeAll(async () => {
  ownerToken = await gw.login(OWNER.email, OWNER.password);
});

test('the pinned PUBLIC_URL outranks the request, and names its authority', async () => {
  // The request arrives at 127.0.0.1:3100 with no forwarded headers; inference would say
  // http://127.0.0.1:3100. The answer must be the pin — scheme, host, and provenance.
  const res = await gw.get<{ baseUrl: string; baseUrlSource: string }>('/admin/config', ownerToken);
  expect(res.status).toBe(200);
  expect(res.body.baseUrl).toBe(`${API_STACK_PUBLIC_URL}/v1`);
  expect(res.body.baseUrlSource).toBe('env');
});

test('forged forwarded headers cannot dislodge the pin', async () => {
  // A client-supplied X-Forwarded-Proto/Host must not rewrite what the operator declared —
  // otherwise anyone who can reach the gateway can make its dashboard hand out their URL.
  const res = await gw.send<{ baseUrl: string; baseUrlSource: string }>('GET', '/admin/config', {
    token: ownerToken,
    headers: { 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'attacker.example.com' },
  });
  expect(res.body.baseUrl).toBe(`${API_STACK_PUBLIC_URL}/v1`);
  expect(res.body.baseUrlSource).toBe('env');
});
