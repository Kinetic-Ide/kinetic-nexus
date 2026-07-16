import type { ComponentChildren } from 'preact';
import type { HealthStatus, StripCell } from '../../api';
import s from './health.module.css';

// The Health page's own visual primitives (P7.12): a status pill, a latency sparkline, a radial
// saturation gauge, and the per-minute status strip. Local to this page rather than in ui/ — no
// other section draws gauges or strips, and hoisting them before a second consumer exists would be
// speculation. All pure SVG/CSS from design tokens; no chart library.

export const STATUS_WORD: Record<HealthStatus, string> = {
  healthy: 'Healthy', degraded: 'Degraded', down: 'Down',
};

export function StatusPill({ status, children }: { status: HealthStatus; children?: ComponentChildren }) {
  return (
    <span class={`${s.pill} ${s['pill_' + status]}`}>
      <span class={s.pillDot} aria-hidden="true" />
      {children ?? STATUS_WORD[status]}
    </span>
  );
}

/**
 * A tiny trend line. Null points (a minute where every probe failed) break the line rather than
 * being drawn as zero — a dead probe must not paint a reassuring dip. Scaled to its own max so the
 * shape reads; the numbers live in the chips beside it.
 */
export function Sparkline({ points, tone = 'ok', label, height = 34 }: {
  points: (number | null)[]; tone?: 'ok' | 'warn'; label: string; height?: number;
}) {
  const W = 120;
  const nums = points.filter((v): v is number => v !== null);
  const max = nums.length ? Math.max(...nums, 0.001) : 1;
  // Build one polyline per contiguous run of real values, so a gap stays a gap.
  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((v, i) => {
    if (v === null) { if (run.length) { runs.push(run.join(' ')); run = []; } return; }
    const x = points.length > 1 ? (i / (points.length - 1)) * W : W;
    const y = height - 4 - (v / max) * (height - 8);
    run.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (run.length) runs.push(run.join(' '));

  if (nums.length === 0) return <span class={s.sparkEmpty}>no data yet</span>;
  return (
    <svg class={s.spark} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {runs.map((pts, i) => (
        <polyline key={i} points={pts} class={tone === 'warn' ? s.sparkWarn : s.sparkOk}
          fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      ))}
    </svg>
  );
}

/** A radial saturation gauge: value/max as an arc, the figure in the middle. Only rendered when a
 *  real ceiling exists — the callers show prose instead of a gauge when there is none. */
export function RadialGauge({ pct, value, sub, warnAt = 80, label }: {
  pct: number; value: string; sub: string; warnAt?: number; label: string;
}) {
  const R = 34, C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(pct, 100));
  const tone = clamped >= 95 ? s.gaugeCrit : clamped >= warnAt ? s.gaugeWarn : s.gaugeOk;
  return (
    <svg class={s.gauge} viewBox="0 0 84 84" role="img" aria-label={label}>
      <circle class={s.gaugeTrack} cx="42" cy="42" r={R} />
      <circle
        class={`${s.gaugeFill} ${tone}`} cx="42" cy="42" r={R}
        stroke-dasharray={`${(clamped / 100) * C} ${C}`}
        transform="rotate(-90 42 42)"
      />
      <text class={s.gaugeVal} x="42" y="40">{value}</text>
      <text class={s.gaugeSub} x="42" y="53">{sub}</text>
    </svg>
  );
}

/** The status-page strip: one cell per minute, worst sample wins, gaps stay grey. */
export function StatusStrip({ cells }: { cells: StripCell[] }) {
  return (
    <div class={s.strip} role="img" aria-label={`Per-minute status for the last ${cells.length} minutes`}>
      {cells.map((c, i) => <span key={i} class={`${s.cell} ${s['cell_' + c]}`} />)}
    </div>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────

export const fmtMs = (v: number | null): string => (v === null ? '—' : v >= 100 ? `${Math.round(v)} ms` : `${v.toFixed(1)} ms`);

export function fmtBytes(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
  if (v >= 1024 ** 2) return `${Math.round(v / 1024 ** 2)} MB`;
  if (v >= 1024)      return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
}

export function fmtUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const fmtCount = (v: number | null): string => (v === null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(Math.round(v)));
