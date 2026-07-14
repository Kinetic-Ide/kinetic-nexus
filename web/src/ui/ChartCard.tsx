import type { ComponentChildren } from 'preact';
import { Card } from './Card';
import { LineChart } from './LineChart';
import s from './ui.module.css';

// A titled metric card: a headline figure over its trend line. Shared by the Overview and Analytics
// pages, so the shape lives here once rather than being repeated per metric. `accent` gives each
// card its own persistent hue (line + fill + the headline number's tick) so the cards read as
// distinct metrics at a glance; `tooltip` lets the hover show the whole day, not just this series.
interface Props {
  title:     string;
  big:       ComponentChildren;
  data:      number[];
  labels?:   string[];
  format?:   (v: number) => string;
  accent?:   string;
  tooltip?:  (i: number) => ComponentChildren;
  ariaLabel: string;
}

export function ChartCard({ title, big, data, labels, format, accent, tooltip, ariaLabel }: Props) {
  return (
    <Card heading={title} class={s.chartCard}>
      <div class={s.chartHead}>
        {accent && <span class={s.chartTick} style={{ background: accent }} />}
        <span class={s.chartBig}>{big}</span>
      </div>
      <LineChart data={data} labels={labels} format={format} accent={accent} tooltip={tooltip} height={120} ariaLabel={ariaLabel} />
    </Card>
  );
}
