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

// Facts one spec file learns that a later file needs — the owner's TOTP secret, minted in
// 01 and required to sign in ever after. The suites are stories sharing one gateway's
// state; a file on disk is that same idea for the few facts the gateway will not repeat
// (show-once secrets). Playwright gives each spec file a fresh worker, so module-level
// state cannot cross files — this can.

import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(__dirname, '..', '.state');

export function saveState(key: string, value: string): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, key), value, 'utf8');
}

export function loadState(key: string): string {
  return fs.readFileSync(path.join(DIR, key), 'utf8');
}
