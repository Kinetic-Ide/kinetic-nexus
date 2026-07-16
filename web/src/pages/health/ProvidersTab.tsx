import { Network, KeyRound, Snowflake, Ban } from 'lucide-preact';
import { Card, StatCard, Spinner, Button, Badge } from '../../ui';
import { useApi } from '../../hooks/useApi';
import type { NexusOverview } from '../../api';
import p from '../pages.module.css';
import s from './health.module.css';

// Provider health, read-only (P7.12). The Nexus section owns pools and keys — banning, cooling,
// testing, editing all live THERE, and duplicating those controls here would split one concept
// across two editors (the same one-editor rule Security follows for network egress). This tab is
// the health-page view of the same facts: how much upstream capacity is alive right now, and where
// to go when it isn't.

export function ProvidersTab() {
  const { data, loading, error, reload } = useApi<NexusOverview>('/admin/nexus/overview');

  if (loading && !data) return <div class={p.centered}><Spinner /> <span>Reading provider health…</span></div>;
  if (error || !data) {
    return (
      <div class={p.errBody}>
        <p>Couldn’t read provider health{error ? ` — ${error}` : ''}.</p>
        <Button size="sm" onClick={reload}>Retry</Button>
      </div>
    );
  }

  const { summary, tiers } = data;
  const usable = summary.totalKeys > 0 ? summary.activeKeys / summary.totalKeys : null;

  return (
    <>
      <div class={`${p.grid} ${p.cols4}`}>
        <StatCard label="Provider pools" value={summary.providers} sub="configured upstreams" icon={<Network size={15} />} tone="var(--blue)" />
        <StatCard label="Active keys" value={summary.activeKeys} sub={usable !== null ? `${Math.round(usable * 100)}% of capacity usable` : 'no keys yet'} icon={<KeyRound size={15} />} tone="var(--green)" />
        <StatCard label="Cooling" value={summary.coolingKeys} sub="rate-limited, recovering" icon={<Snowflake size={15} />} tone="var(--yellow)" />
        <StatCard label="Banned" value={summary.bannedKeys} sub="dead credentials" icon={<Ban size={15} />} tone="var(--red)" />
      </div>

      <Card class={p.section}>
        <div class={s.panelHead}>
          <b>Capacity by tier</b>
          <span class={s.panelTag}>read-only</span>
          <a href="/nexus" class={s.panelMeta}>manage pools and keys in Nexus →</a>
        </div>
        {tiers.length === 0 ? (
          <p class={p.setDesc}>No provider pools yet. Add one in Nexus to start routing traffic.</p>
        ) : tiers.map(({ tier, providers }) => (
          <div key={tier} class={s.tblRows}>
            <div class={`${s.tblRow} ${s.tblHead}`}><span>{tier} tier</span><span>keys</span><span>health</span></div>
            {providers.map((pool) => {
              const active  = pool.keys.filter((k) => k.status === 'active' && !k.coolingUntil).length;
              const cooling = pool.keys.filter((k) => !!k.coolingUntil && k.status === 'active').length;
              const banned  = pool.keys.filter((k) => k.status === 'banned').length;
              return (
                <div key={pool.id} class={s.tblRow}>
                  <span class={s.tblName}>{pool.name}</span>
                  <span>{pool.keys.length}</span>
                  <span>
                    <Badge tone={active > 0 ? 'green' : banned === pool.keys.length && pool.keys.length > 0 ? 'red' : 'yellow'}>
                      {active > 0 ? `${active} active` : pool.keys.length === 0 ? 'no keys' : cooling > 0 ? `${cooling} cooling` : `${banned} banned`}
                    </Badge>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}
