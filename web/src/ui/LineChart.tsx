import { useRef, useState } from 'preact/hooks';
import s from './ui.module.css';

interface Props {
  data:       number[];
  /** Optional per-point labels (e.g. dates) shown in the hover tooltip. */
  labels?:    string[];
  /** How a value is rendered in the tooltip (compact number, currency, …). */
  format?:    (v: number) => string;
  height?:    number;
  ariaLabel?: string;
}

// Per-instance gradient id: multiple charts share a page, so each needs its own <defs> id.
let gradSeq = 0;

/**
 * A dependency-free, theme-aware SVG line+area chart. Deliberately no charting library —
 * this is self-contained (the old dashboard's CDN-loaded Chart.js broke air-gapped / strict-CSP
 * installs), reads its colours from CSS tokens, and stretches to its container.
 *
 * It is interactive: hovering shows a crosshair, a highlighted point, and a tooltip with that
 * day's label and value, and the line draws itself in on first paint — so the data feels live, not
 * static. The overlay is positioned in percentages (robust to the stretched viewBox) and rendered
 * as HTML so a dot stays circular despite `preserveAspectRatio="none"`.
 *
 * The area is filled with a vertical gradient that fades to transparent at the bottom rather than a
 * flat translucency, which would leave a hard bottom edge reading as a faint line over the dark
 * surface. The line stroke already covers the top edge, so the fill just dissolves downward.
 */
export function LineChart({ data, labels, format = (v) => String(v), height = 120, ariaLabel = 'Line chart' }: Props) {
  const W = 320;
  const H = height;
  const P = 6;
  const gradId = useRef(`nx-chart-fill-${gradSeq++}`).current;
  const [hover, setHover] = useState<number | null>(null);

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

  const pts  = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M ${x(0).toFixed(2)},${(H - P).toFixed(2)} L ${pts.join(' L ')} L ${x(n - 1).toFixed(2)},${(H - P).toFixed(2)} Z`;

  // Overlay geometry as percentages of the container (the viewBox is stretched, so px math on the
  // viewBox coordinates would be wrong; percentages track the render exactly).
  const leftPct = (i: number) => (x(i) / W) * 100;
  const topPct  = (v: number) => (y(v) / H) * 100;

  const onMove = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (r.width === 0) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const i  = n === 1 ? 0 : Math.round(((fx * W) - P) / ((W - 2 * P) / (n - 1)));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const tipLeft = Math.min(88, Math.max(12, leftPct(hover ?? 0))); // keep the tooltip off the edges

  return (
    <div class={s.chartWrap} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class={s.chartFill} d={area} fill={`url(#${gradId})`} />
        <path class={s.chartLine} d={line} vector-effect="non-scaling-stroke" pathLength={1} />
      </svg>
      {hover !== null && (
        <>
          <span class={s.chartCrosshair} style={{ left: `${leftPct(hover)}%` }} />
          <span class={s.chartHoverDot} style={{ left: `${leftPct(hover)}%`, top: `${topPct(data[hover])}%` }} />
          <span class={s.chartTip} style={{ left: `${tipLeft}%`, top: `${topPct(data[hover])}%` }}>
            {labels?.[hover] && <b>{labels[hover]}</b>}
            <span>{format(data[hover])}</span>
          </span>
        </>
      )}
    </div>
  );
}
