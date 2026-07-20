/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 */

// Builds the static demo into ../docs/demo.
//
// A wrapper rather than `VITE_DEMO=1 vite build` in package.json, because that syntax is not
// portable to a Windows shell and adding cross-env just to set one variable is a dependency for
// nothing. Also copies index.html to 404.html: GitHub Pages has no SPA fallback, so a deep link or
// a refresh on /demo/teams would return Pages' own 404 page — serving the app from 404.html is the
// standard way to make client-side routing survive that.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here    = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const outDir  = join(webRoot, '..', 'docs', 'demo');

const env = { ...process.env, VITE_DEMO: '1' };

const build = spawnSync('npx', ['vite', 'build'], {
  cwd: webRoot, env, stdio: 'inherit', shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const indexHtml = join(outDir, 'index.html');
if (!existsSync(indexHtml)) {
  console.error(`\nExpected ${indexHtml} after the build, and it is not there. Refusing to claim success.\n`);
  process.exit(1);
}
copyFileSync(indexHtml, join(outDir, '404.html'));

// Pages runs the output through Jekyll by default, which silently drops files and folders beginning
// with an underscore. Vite does not emit any today, but a future asset name would fail invisibly.
const nojekyll = join(outDir, '.nojekyll');
if (!existsSync(nojekyll)) {
  copyFileSync(join(webRoot, 'scripts', 'nojekyll.txt'), nojekyll);
}

console.log(`\n  demo built  → docs/demo`);
console.log(`  404.html    → SPA fallback for deep links`);
console.log(`  .nojekyll   → Pages serves the files as-is\n`);
