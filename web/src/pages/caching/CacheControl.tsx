import { useState } from 'preact/hooks';
import { Toggle, Field, Input } from '../../ui';
import type { CacheConfig } from '../../api';
import { SettingsSection, SaveBar, type SaveCtx } from '../settings/SettingsSection';
import s from '../pages.module.css';

// The response-cache control, relocated from Settings into the Caching section (P7.7) so the switch
// and the numbers it drives live in one place. It writes the same /admin/settings/cache endpoint it
// always did. The TTL is the whole risk here, so it is spelled out rather than left as a bare number:
// a cached answer is replayed without ever asking the provider, so a stale one is served for exactly
// as long as the TTL says.
const PRESETS = [
  { label: '5 minutes', secs: 300 },
  { label: '1 hour',    secs: 3600 },
  { label: '1 day',     secs: 86400 },
];

function humanTtl(secs: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (secs < 60)   return plural(secs, 'second');
  if (secs < 3600) return plural(Math.round(secs / 60), 'minute');
  if (secs < 86400) { const h = secs / 3600; return `${h.toFixed(secs % 3600 ? 1 : 0)} ${h === 1 ? 'hour' : 'hours'}`; }
  const d = secs / 86400; return `${d.toFixed(secs % 86400 ? 1 : 0)} ${d === 1 ? 'day' : 'days'}`;
}

export function CacheControl({ onSaved }: { onSaved?: () => void }) {
  return (
    <SettingsSection<CacheConfig>
      path="/admin/settings/cache"
      title="Response cache"
      description="Serve an identical repeat request straight from cache instead of calling the provider again. Off by default — a fresh gateway caches nothing until you turn this on."
    >
      {(data, ctx) => <CacheForm data={data} ctx={ctx} onSaved={onSaved} />}
    </SettingsSection>
  );
}

function CacheForm({ data, ctx, onSaved }: { data: CacheConfig; ctx: SaveCtx<CacheConfig>; onSaved?: () => void }) {
  // Seeded once on mount; SettingsSection remounts this form after a save so it re-seeds from what
  // the gateway actually stored.
  const [enabled, setEnabled] = useState(data.enabled);
  const [ttl, setTtl]         = useState(String(data.ttlSeconds));

  const ttlSeconds = Math.max(1, parseInt(ttl, 10) || data.ttlSeconds);
  const dirty = enabled !== data.enabled || ttlSeconds !== data.ttlSeconds;

  return (
    <>
      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label="Serve repeat requests from cache"
        hint="A cache hit costs nothing and returns instantly. The figures above show what it has saved."
      />

      <Field label="How long an answer stays fresh" hint="seconds">
        <Input type="number" min={1} max={2592000} value={ttl} onInput={(e) => setTtl((e.target as HTMLInputElement).value)} />
      </Field>

      <div class={s.presetRow}>
        {PRESETS.map((p) => (
          <button key={p.secs} type="button" class={s.preset} onClick={() => setTtl(String(p.secs))}>{p.label}</button>
        ))}
      </div>

      <p class={s.warnNote}>
        <b>Staleness is the trade-off.</b> For {humanTtl(ttlSeconds)} after an answer is cached, an
        identical request gets that same answer — even if the underlying data changed in the
        meantime. Keep it short if your prompts read from anything that moves.
      </p>

      <SaveBar
        ctx={ctx}
        dirty={dirty}
        // The page header's on/off badge reads from /admin/cache/stats, a different request from
        // the one this form writes — tell the page to refetch, or the badge lies until a reload.
        onSave={() => void ctx.save({ enabled, ttlSeconds }).then((r) => { if (r) onSaved?.(); })}
      />
    </>
  );
}
