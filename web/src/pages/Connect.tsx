import { Plug, ShieldAlert } from 'lucide-preact';
import { PageHeader, Card, CopyField, Spinner, Button, Table, Badge, type Column } from '../ui';
import { useApi } from '../hooks/useApi';
import type { GatewayConfig } from '../api';
import { QuickStart } from './connect/QuickStart';
import { ApiKeyPanel } from './connect/ApiKeyPanel';
import { OriginTruth, judgeOrigin } from './connect/OriginTruth';
import s from './pages.module.css';

interface Endpoint { method: string; path: string; purpose: string; }

// The OpenAI- and Anthropic-compatible surface the gateway exposes. Paths are relative to the base
// URL; "auto" as the model lets the router choose per the rules in Nexus.
const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/v1/chat/completions',     purpose: 'Chat (OpenAI-compatible)' },
  { method: 'POST', path: '/v1/messages',             purpose: 'Chat (Anthropic-compatible)' },
  { method: 'POST', path: '/v1/embeddings',           purpose: 'Text embeddings' },
  { method: 'POST', path: '/v1/images/generations',   purpose: 'Image generation' },
  { method: 'POST', path: '/v1/audio/speech',         purpose: 'Text-to-speech' },
  { method: 'POST', path: '/v1/audio/transcriptions', purpose: 'Speech-to-text' },
  { method: 'GET',  path: '/v1/models',               purpose: 'List available models' },
];

// P7.3: the redesigned Connect section — everything a developer needs to point a client at this
// gateway: the base URL, the key, the endpoint reference, and filled-in quick-start snippets.
export function Connect() {
  const { data, loading, error, reload } = useApi<GatewayConfig>('/admin/config');

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Connect" subtitle="Point your client at the gateway" />
        <div class={s.centered}><Spinner /> <span>Loading connection…</span></div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Connect" subtitle="Point your client at the gateway" />
        <div class={s.errBody}>
          <Plug size={22} class={s.errIcon} />
          <p>Couldn’t load connection details{error ? ` — ${error}` : ''}.</p>
          <Button size="sm" onClick={reload}>Retry</Button>
        </div>
      </>
    );
  }

  // Two different URLs, named separately — conflating them is exactly what broke this page.
  //
  // `GET /admin/config` returns the /v1 API base (lib/baseUrl.ts: `${origin}/v1`), which is what you
  // paste into an OpenAI client. But every path below is written from the ROOT
  // ("/v1/chat/completions"), so joining them onto the same value produced
  // `…/v1/v1/chat/completions` — a 404 — on the one page whose entire job is "copy this and it
  // works". Wrong since the P7.9 cutover; found by live-testing P7.13a against a real gateway. The
  // unit test never caught it because its fixture passes a base URL with no /v1, which no real
  // deployment ever sends.
  const serverOrigin  = data.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  // P7.14: the server's origin is a claim; the address bar is a witness. judgeOrigin picks which
  // one every copyable value uses, and OriginTruth explains the verdict beneath the Base URL.
  const browserOrigin = window.location.origin;
  const origin        = judgeOrigin(serverOrigin, data.baseUrlSource, browserOrigin).origin;
  const apiBaseUrl    = `${origin}/v1`;                          // …/v1 — for an SDK's base_url

  const endpointCols: Column<Endpoint>[] = [
    { key: 'purpose', label: 'Purpose' },
    { key: 'method',  label: 'Method', render: (e) => <Badge tone="gray">{e.method}</Badge> },
    { key: 'path',    label: 'Path',   render: (e) => <code class={s.epPath}>{origin}{e.path}</code> },
  ];

  return (
    <>
      <PageHeader title="Connect" subtitle="Point your client at the gateway" />

      <div class={`${s.grid} ${s.cols1}`}>
        <Card heading="Connection">
          <div class={s.connFields}>
            <CopyField label="Base URL" value={apiBaseUrl} />
          </div>
          <OriginTruth serverOrigin={serverOrigin} source={data.baseUrlSource} browserOrigin={browserOrigin} />
          <ApiKeyPanel apiKeySet={data.apiKeySet} apiKeyMasked={data.apiKeyMasked} onRotated={reload} />
          <div class={s.rulesNote}>
            <ShieldAlert size={13} /> Treat the API key like a password — anyone with it can spend against your providers.
          </div>
        </Card>
      </div>

      <div class={s.section}><QuickStart baseUrl={origin} /></div>

      <div class={s.section}>
        <Card heading="Endpoints">
          <Table columns={endpointCols} rows={ENDPOINTS} rowKey={(e) => e.path} />
        </Card>
      </div>
    </>
  );
}
