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

import { PRICING_CATALOG, type PricingCatalogEntry } from '../data/pricingCatalog';

// Read-only access to the bundled pricing catalog, plus the model→entry lookup the editor's
// "auto-fill" uses. Matching is longest-prefix: an exact model string wins, otherwise the most
// specific `match` prefix does (so `gpt-4o-mini` never falls through to the shorter `gpt-4o`).

export type { PricingCatalogEntry };

export function getPricingCatalog(): PricingCatalogEntry[] {
  return PRICING_CATALOG;
}

/** The best catalog entry for a model string, or null when nothing matches. */
export function lookupPricing(modelString: string): PricingCatalogEntry | null {
  const id = (modelString || '').trim().toLowerCase();
  if (!id) return null;
  let best: PricingCatalogEntry | null = null;
  for (const entry of PRICING_CATALOG) {
    const m = entry.match.toLowerCase();
    if (id === m || id.startsWith(m)) {
      if (!best || entry.match.length > best.match.length) best = entry;
    }
  }
  return best;
}
