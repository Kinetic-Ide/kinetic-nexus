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

import { FlaskConical, ArrowUpRight } from 'lucide-preact';
import s from './demo.module.css';

const REPO = 'https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus';

/**
 * The strip across the top of the static demo.
 *
 * It exists so nobody has to guess. The figures below it are real output from a real gateway, but
 * that gateway was seeded with synthetic traffic — saying so plainly costs nothing and is the
 * difference between a demo and a misleading claim. It also gives the visitor the one thing the
 * demo cannot: a way to run the actual thing.
 */
export function DemoBanner() {
  return (
    <div class={s.banner} role="note">
      <FlaskConical size={15} class={s.bannerIcon} />
      <span class={s.bannerText}>
        <b>Demo</b> — a real gateway's data, seeded with synthetic traffic. Signed in as a viewer, so
        nothing here can be changed.
      </span>
      <a class={s.bannerCta} href={`${REPO}#quick-start`} target="_blank" rel="noreferrer">
        Run it yourself <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
