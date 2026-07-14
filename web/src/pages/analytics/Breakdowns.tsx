import { Card, Table, Badge, type Column } from '../../ui';
import { compactNumber, currency } from '../../lib/format';
import { modalityMeta, outcomeMeta } from './outcomes';
import type { AnalyticsOverview } from '../../api';
import s from '../pages.module.css';

// The four "where did it go" breakdowns. They live in one file because they are the same idea four
// times — a titled table over one slice of the aggregate — and four near-identical files would
// obscure that rather than clarify it. Each still owns its own columns and its own empty message.
// The Table primitive supplies the chrome and the empty state.

type Overview = AnalyticsOverview;

export function ByModel({ rows }: { rows: Overview['byModel'] }) {
  const cols: Column<Overview['byModel'][number]>[] = [
    { key: 'model',    label: 'Model',    render: (r) => <span class={s.modelId}>{r.model}</span> },
    { key: 'requests', label: 'Requests', align: 'right', render: (r) => compactNumber(r.requests) },
    { key: 'tokens',   label: 'Tokens',   align: 'right', render: (r) => compactNumber(r.tokens) },
    { key: 'usd',      label: 'Cost',     align: 'right', render: (r) => currency(r.usd) },
  ];
  return (
    <Card heading="Busiest models">
      <Table columns={cols} rows={rows} rowKey={(r) => r.model} empty="No model traffic in this window" />
    </Card>
  );
}

export function ByProvider({ rows }: { rows: Overview['byProvider'] }) {
  const cols: Column<Overview['byProvider'][number]>[] = [
    { key: 'provider', label: 'Provider', render: (r) => <Badge tone="gray">{r.provider}</Badge> },
    { key: 'requests', label: 'Requests', align: 'right', render: (r) => compactNumber(r.requests) },
    // A provider's error count is the one number that tells you which upstream is hurting you.
    { key: 'errors',   label: 'Errors',   align: 'right', render: (r) => (
      r.errors > 0 ? <span class={s.errCount}>{compactNumber(r.errors)}</span> : <span class={s.zeroCount}>0</span>
    ) },
    { key: 'usd',      label: 'Cost',     align: 'right', render: (r) => currency(r.usd) },
  ];
  return (
    <Card heading="By provider">
      <Table columns={cols} rows={rows} rowKey={(r) => r.provider} empty="No provider traffic in this window" />
    </Card>
  );
}

export function ByModality({ rows }: { rows: Overview['byModality'] }) {
  const cols: Column<Overview['byModality'][number]>[] = [
    { key: 'unit',     label: 'Kind',     render: (r) => modalityMeta(r.unit).label },
    { key: 'requests', label: 'Requests', align: 'right', render: (r) => compactNumber(r.requests) },
    // Text is billed on tokens; every other modality is billed on its own natural unit (images,
    // characters, files), so this column shows whichever one actually applies.
    { key: 'volume',   label: 'Volume',   align: 'right', render: (r) => (
      <span>
        {compactNumber(r.unit === 'token' ? r.tokens : r.quantity)}{' '}
        <span class={s.modalityUnit}>{modalityMeta(r.unit).unit}</span>
      </span>
    ) },
    { key: 'usd',      label: 'Cost',     align: 'right', render: (r) => currency(r.usd) },
  ];
  return (
    <Card heading="By kind of work">
      <Table columns={cols} rows={rows} rowKey={(r) => r.unit} empty="No successful requests in this window" />
    </Card>
  );
}

export function ByOutcome({ rows }: { rows: Overview['byOutcome'] }) {
  // Successes are the bulk of a healthy window and are already the headline stat. This table exists
  // to answer "what went wrong", so it shows only the failures.
  const failures = rows.filter((r) => r.outcome !== 'success');
  const cols: Column<Overview['byOutcome'][number]>[] = [
    { key: 'outcome', label: 'What happened', render: (r) => {
      const m = outcomeMeta(r.outcome);
      return (
        <div class={s.outcomeCell}>
          <Badge tone={m.tone}>{m.label}</Badge>
          <span class={s.outcomeHelp}>{m.help}</span>
        </div>
      );
    } },
    { key: 'requests', label: 'Requests', align: 'right', render: (r) => compactNumber(r.requests) },
  ];
  return (
    <Card heading="What went wrong">
      <Table columns={cols} rows={failures} rowKey={(r) => r.outcome} empty="No failed requests in this window" />
    </Card>
  );
}
