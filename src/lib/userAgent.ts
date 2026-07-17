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

// Turn a User-Agent header into the short phrase a person recognises on the sessions
// panel — "Chrome on Windows", "Safari on macOS". Deliberately coarse: this string is
// self-reported by the client and is DESCRIPTIVE ONLY, never an authentication factor
// (any client can claim any user-agent). Its one honest job is to help a person spot a
// session that is not theirs. No parsing library: the fingerprinting arms race is not a
// fight this gateway needs, and a wrong guess here misleads, so unknowns stay unknown.

/** Order matters: Edge and Opera embed "Chrome"; Chrome embeds "Safari". */
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
  [/curl\//, 'curl'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Windows NT/, 'Windows'],
  [/Android/, 'Android'],          // Android UAs also contain "Linux" — check first
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua?.trim()) return 'Unknown device';
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system  = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
