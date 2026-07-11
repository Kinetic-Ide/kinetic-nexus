import { useRef } from 'preact/hooks';
import s from './ui.module.css';

interface Props {
  data: number[];
  height?: number;
  ariaLabel?: string;
}

// Per-instance gradient id: multiple charts share a page, so each needs its own <defs> id.
let gradSeq = 0;

/**
 * A dependency-free, theme-aware SVG line+area chart. Deliberately no charting library —
 * this is self-contained (the old dashboard's CDN-loaded Chart.js broke air-gapped / strict-CSP
 * installs), reads its colours from CSS tokens, and stretches to its container. P7.2 layers axes,
 * tooltips, and multi-series on this same seam.
 *
 * The area is filled with a vertical gradient that fades to fully transparent at the bottom rather
 * than a flat translucency: a flat fill leaves a hard bottom edge that reads as a faint horizontal
 * line over the dark surface. The line stroke already covers the top edge, so the fill just needs
 * to dissolve downward.
 */
export function LineChart({ data, height = 120, ariaLabel = 'Line chart' }: Props) {
  const W = 320;
  const H = height;
  const P = 6;
  const gradId = useRef(`nx-chart-fill-${gradSeq++}`).current;

  if (!data.length) {
    return (
      <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <text x={W / 2} y={H / 2} text-anchor="middle" dominant-baseline="middle" class={s.chartEmpty}>No data yet</text>
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => P + (1 - (v - min) / range) * (H - 2 * P);

  const pts = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M ${x(0).toFixed(2)},${(H - P).toFixed(2)} L ${pts.join(' L ')} L ${x(n - 1).toFixed(2)},${(H - P).toFixed(2)} Z`;

  return (
    <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.22" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path class={s.chartLine} d={line} vector-effect="non-scaling-stroke" />
    </svg>
  );
}
