import { compactNumber, currency } from '../../lib/format';
import type { AnalyticsDay } from '../../api';
import s from '../../ui/ui.module.css';

// Hovering any Analytics chart shows the whole day, not just the series under the cursor —
// requests, how many failed, latency, spend, and what the cache saved. Seeing a cost spike next to
// that day's failure count is usually the answer, and showing both costs nothing.
export type DayMetric = 'requests' | 'errors' | 'avgLatencyMs' | 'usd';

export const DAY_ACCENTS: Record<DayMetric, string> = {
  requests:     'var(--green)',
  errors:       'var(--red)',
  avgLatencyMs: 'var(--blue)',
  usd:          'var(--orange)',
};

const ROWS: { key: DayMetric; label: string; fmt: (d: AnalyticsDay) => string }[] = [
  { key: 'requests',     label: 'Requests',    fmt: (d) => compactNumber(d.requests) },
  { key: 'errors',       label: 'Failed',      fmt: (d) => compactNumber(d.errors) },
  // A day with no measured latency shows a dash, not a confident "0 ms".
  { key: 'avgLatencyMs', label: 'Avg latency', fmt: (d) => (d.avgLatencyMs > 0 ? `${compactNumber(d.avgLatencyMs)} ms` : '—') },
  { key: 'usd',          label: 'Cost',        fmt: (d) => currency(d.usd) },
];

export function DayTip({ day, label, active }: { day: AnalyticsDay; label: string; active: DayMetric }) {
  return (
    <>
      <b>{label}</b>
      {ROWS.map((r) => (
        <span key={r.key} class={`${s.chartTipRow} ${r.key === active ? s.chartTipRowActive : ''}`}>
          <span><i class={s.chartTipDot} style={{ background: DAY_ACCENTS[r.key] }} />{r.label}</span>
          <span>{r.fmt(day)}</span>
        </span>
      ))}
      {day.savedUsd > 0 && (
        <span class={s.chartTipRow}>
          <span><i class={s.chartTipDot} style={{ background: 'var(--green)' }} />Cache saved</span>
          <span>{currency(day.savedUsd)}</span>
        </span>
      )}
    </>
  );
}
