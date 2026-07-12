import { GET, type PricingCatalogEntry } from '../api';

// Client access to the bundled pricing catalog behind the editor's "auto-fill". The catalog is
// fetched once and matched locally; matching mirrors the server's longest-prefix rule so an exact
// model string wins and `gpt-4o-mini` never falls through to `gpt-4o`.

export const loadPricingCatalog = () =>
  GET<{ catalog: PricingCatalogEntry[] }>('/admin/models/pricing-catalog').then((r) => r.catalog);

/** Best catalog entry for a model string, or null. Longest matching prefix wins. */
export function matchCatalog(catalog: PricingCatalogEntry[], modelString: string): PricingCatalogEntry | null {
  const id = (modelString || '').trim().toLowerCase();
  if (!id) return null;
  let best: PricingCatalogEntry | null = null;
  for (const e of catalog) {
    const m = e.match.toLowerCase();
    if ((id === m || id.startsWith(m)) && (!best || e.match.length > best.match.length)) best = e;
  }
  return best;
}
