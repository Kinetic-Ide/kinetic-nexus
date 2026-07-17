import { useState } from 'preact/hooks';
import { MonitorSmartphone } from 'lucide-preact';
import { POST, DEL, type SessionsResponse, type SessionRow } from '../../api';
import { useApi } from '../../hooks/useApi';
import { relativeTime } from '../../lib/format';
import { Card, Button, Badge, Table, FormError, Spinner, type Column } from '../../ui';
import s from './admin.module.css';

// Where you're signed in (Phase 7.13b). Every row is one of YOUR sessions — the gateway's
// per-user index cannot produce anyone else's, so there is no user id in any request here.
//
// The browser and IP are what the client claimed at sign-in, shown so a person can spot a
// session they don't recognise — not proof of anything. The remedy for an unrecognised row
// is the button next to it.

export function Sessions() {
  const list = useApi<SessionsResponse>('/admin/me/sessions');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await fn();
      list.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (list.loading) return <Spinner />;
  if (list.error || !list.data) return <Card><FormError>{list.error ?? 'Could not load your sessions.'}</FormError></Card>;

  const sessions = list.data.sessions;
  const others = sessions.filter((x) => !x.current).length;

  const columns: Column<SessionRow>[] = [
    {
      key: 'browser', label: 'Device',
      render: (x) => (
        <div class={s.person}>
          <span class={s.personName} title={x.userAgent}>
            {x.browser}
            {x.current && <span class={s.you}>This device</span>}
          </span>
          <span class={s.personEmail}>{x.ip ?? 'IP unknown'}</span>
        </div>
      ),
    },
    {
      key: 'createdAt', label: 'Signed in',
      render: (x) => relativeTime(new Date(x.createdAt).toISOString()),
    },
    {
      key: 'lastSeenAt', label: 'Last active',
      // "Last active" is coarse by design: the gateway refreshes it at most once a minute,
      // so a session reading as "just now" may be up to a minute stale.
      render: (x) => (x.current ? 'Now' : relativeTime(new Date(x.lastSeenAt).toISOString())),
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (x) => (x.current
        ? <span class={s.selfNote}>Use Sign out in the sidebar</span>
        : (
          <Button variant="danger" disabled={busy} onClick={() => void act(() => DEL(`/admin/me/sessions/${x.id}`))}>
            Sign out
          </Button>
        )),
    },
  ];

  return (
    <div class={s.section}>
      <Card>
        <div class={s.head}>
          <div class={s.headText}>
            <span class={s.headTitle}>Where you're signed in</span>
            <span class={s.headSub}>
              Every browser holding a live session for your account. Signing one out takes
              effect immediately — its next request is refused.
            </span>
          </div>
          {others > 0 && (
            <Button disabled={busy} onClick={() => void act(() => POST('/admin/me/sessions/revoke-others'))}>
              <MonitorSmartphone size={14} /> Sign out everywhere else
            </Button>
          )}
        </div>

        {error && <FormError>{error}</FormError>}

        <Table
          columns={columns}
          rows={sessions}
          rowKey={(x) => x.id}
          empty="No live sessions — which should be impossible, since you are reading this through one."
        />

        {sessions.length === 1 && <Badge tone="green" dot>Only this device</Badge>}
      </Card>
    </div>
  );
}
