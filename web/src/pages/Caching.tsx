import { Database, Percent, Coins, DatabaseZap } from 'lucide-preact';
import { PageHeader, Card, StatCard, Badge, Button, Spinner } from '../ui';
import { useApi } from '../hooks/useApi';
import { compactNumber, currency } from '../lib/format';
import type { CacheStats } from '../api';
import { CacheControl } from './caching/CacheControl';
import { PurgeCard } from './caching/PurgeCard';
import s from './pages.module.css';

// P7.7: the Caching section — the operational home for the response cache. The control that turns it
// on and sets the TTL moved here from Settings so the switch and the numbers it drives sit together;
// the stats and one-click purge are new. Hit rate and savings are read over a recent window (cache
// outcomes were only recorded from P7.5a on), so an idle stretch reads as a real 0%, never a
// flattering all-time figure.

function pct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0%';
  const p = rate * 100;
  return (p >= 10 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
}

export function Caching() {
  const { data, loading, error, reload } = useApi<CacheStats>('/admin/cache/stats');

  return (
    <>
      <PageHeader
        title="Caching"
        subtitle="Identical repeat requests, served from cache instead of a provider"
        actions={data ? <Badge tone={data.config.enabled ? 'green' : 'yellow'}>{data.config.enabled ? 'Cache is on' : 'Cache is off'}</Badge> : undefined}
      />

      {loading && !data && <Card><div class={s.centered}><Spinner /> <span>Loading cache status…</span></div></Card>}

      {error && !data && (
        <Card>
          <div class={s.errBody}>
            <DatabaseZap size={22} class={s.errIcon} />
            <p>Couldn’t load cache status — {error}.</p>
            <Button size="sm" onClick={reload}>Retry</Button>
          </div>
        </Card>
      )}

      {data && (
        <>
          <div class={`${s.grid} ${s.cols3}`}>
            <StatCard label="In cache now" value={compactNumber(data.entries)} sub="cached responses" icon={<Database size={15} />} tone="var(--blue)" />
            <StatCard label={`Hit rate · ${data.windowDays}d`} value={pct(data.recent.hitRate)} sub={`${data.recent.hits.toLocaleString()} of ${data.recent.requests.toLocaleString()} requests`} icon={<Percent size={15} />} tone="var(--accent)" />
            <StatCard label={`Saved · ${data.windowDays}d`} value={currency(data.recent.savedUsd)} sub="vs. paying a provider" icon={<Coins size={15} />} tone="var(--green)" />
          </div>

          <div class={`${s.grid} ${s.cols2} ${s.section}`}>
            <CacheControl onSaved={reload} />
            <PurgeCard entries={data.entries} onPurged={reload} />
          </div>

          <p class={s.dataNote}>
            Hit rate and savings cover the last {data.windowDays} days. A hit costs nothing and returns
            instantly; “saved” is what those hits would have cost had they reached a provider.
          </p>
        </>
      )}
    </>
  );
}
