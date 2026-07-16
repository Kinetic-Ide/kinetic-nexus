import { Gauge } from 'lucide-preact';
import { Card, EmptyState } from '../../ui';
import p from '../pages.module.css';

// Benchmarks (backlog). The tab exists because the Health section is where benchmarks will live;
// the feature does not yet, and this page says so instead of showing invented numbers. When it
// lands (see the plan's backlog): run a standard prompt set through each configured pool on demand,
// report tokens/sec, time-to-first-token and cost side by side, and export a branded PDF.

export function BenchmarksTab() {
  return (
    <Card>
      <EmptyState icon={<Gauge size={22} />}>Benchmarks are not built yet.</EmptyState>
      <p class={p.setDesc} style={{ textAlign: 'center', maxWidth: '520px', margin: '0 auto 8px' }}>
        Planned here: run a standard prompt set through your configured providers on demand and compare
        tokens per second, time to first token, and cost per request — with a downloadable report.
        Until that ships, this tab stays honestly empty rather than showing numbers the gateway never
        measured.
      </p>
    </Card>
  );
}
