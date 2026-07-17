import { useState } from 'preact/hooks';
import { KeyRound, Trash2 } from 'lucide-preact';
import { POST, DEL, ApiError, type AdminApiTokenRow } from '../../api';
import { Card, Button, Badge, Spinner, Table, Field, Input, Select, FieldRow, CopyField, FormError, Modal, type Column } from '../../ui';
import { useApi } from '../../hooks/useApi';
import { relativeTime } from '../../lib/format';
import { isOwner } from '../../lib/access';
import s from '../pages.module.css';

// Admin API tokens: the credential scripts and CI use instead of the password (they cannot present a
// second factor). Minting and revoking are owner-only on the server; a viewer sees a read-only note.
// The plaintext token is returned exactly once, at creation — after that only its mask is ever shown.

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return 'Your session is read-only (viewer). An owner credential is required to manage tokens.';
  }
  return err instanceof ApiError ? err.message : fallback;
}

export function ApiTokens() {
  const { data, loading, error, reload } = useApi<{ tokens: AdminApiTokenRow[] }>('/admin/tokens');
  const owner = isOwner();

  const [name, setName]         = useState('');
  const [role, setRole]         = useState<'owner' | 'viewer'>('owner');
  const [minting, setMinting]   = useState(false);
  const [fresh, setFresh]       = useState<{ name: string; token: string } | null>(null);
  const [formError, setFormErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AdminApiTokenRow | null>(null);
  const [revokeBusy, setRevBusy] = useState(false);

  const mint = async () => {
    if (!name.trim() || minting) return;
    setMinting(true); setFormErr(null); setFresh(null);
    try {
      const { token } = await POST<{ token: { token: string; name: string } }>('/admin/tokens', { name: name.trim(), role });
      setFresh({ name: token.name, token: token.token });
      setName('');
      reload();
    } catch (e) { setFormErr(friendlyError(e, 'Could not create the token.')); }
    finally { setMinting(false); }
  };

  const revoke = async () => {
    if (!revoking || revokeBusy) return;
    setRevBusy(true); setFormErr(null);
    try { await DEL(`/admin/tokens/${revoking.id}`); setRevoking(null); reload(); }
    catch (e) { setFormErr(friendlyError(e, 'Could not revoke the token.')); setRevoking(null); }
    finally { setRevBusy(false); }
  };

  const cols: Column<AdminApiTokenRow>[] = [
    { key: 'name', label: 'Name', render: (t) => <span class={s.tokenName}>{t.name}</span> },
    { key: 'role', label: 'Role', render: (t) => <Badge tone={t.role === 'owner' ? 'blue' : 'gray'}>{t.role}</Badge> },
    { key: 'maskedKey', label: 'Token', render: (t) => <code class={s.tokenMask}>{t.maskedKey}</code> },
    { key: 'lastUsedAt', label: 'Last used', align: 'right', render: (t) => <span class={s.tokenWhen}>{t.lastUsedAt ? relativeTime(t.lastUsedAt) : 'never'}</span> },
    { key: 'createdAt', label: 'Created', align: 'right', render: (t) => <span class={s.tokenWhen} title={t.createdAt}>{relativeTime(t.createdAt)}</span> },
    { key: 'actions', label: '', align: 'right', render: (t) => (owner
      ? <Button size="sm" variant="ghost" onClick={() => { setFormErr(null); setRevoking(t); }} aria-label={`Revoke ${t.name}`}><Trash2 size={13} /></Button>
      : null
    ) },
  ];

  return (
    <>
      {owner ? (
        <Card heading="Create a token">
          <p class={s.setDesc}>
            For scripts and CI. An <b>owner</b> token can do anything the dashboard can; a <b>viewer</b>{' '}
            token can only read. The token is shown once — copy it now.
          </p>
          {formError && <FormError>{formError}</FormError>}
          <FieldRow>
            <Field label="Name" hint="what it's for"><Input value={name} placeholder="ci-pipeline" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></Field>
            <Field label="Role"><Select value={role} onChange={(e) => setRole((e.target as HTMLSelectElement).value as 'owner' | 'viewer')}><option value="owner">owner</option><option value="viewer">viewer</option></Select></Field>
          </FieldRow>
          <Button variant="primary" size="sm" onClick={mint} disabled={!name.trim() || minting}>
            <KeyRound size={13} /> {minting ? 'Creating…' : 'Create token'}
          </Button>

          {fresh && (
            <div class={s.tokenFresh}>
              <p class={s.tokenFreshWarn}><b>Copy “{fresh.name}” now.</b> This is the only time the full token is shown.</p>
              <CopyField value={fresh.token} />
            </div>
          )}
        </Card>
      ) : (
        <Card heading="API tokens">
          <p class={s.setDesc}>
            The credential scripts and CI use instead of a password. Only an owner can create or
            revoke them — you can see what exists below.
          </p>
        </Card>
      )}

      <Card heading="Active tokens" class={s.section}>
        {loading && !data && <div class={s.centered}><Spinner /> <span>Loading tokens…</span></div>}
        {error && !data && (
          <div class={s.errBody}>
            <p>Couldn’t load tokens — {error}.</p>
            <Button size="sm" onClick={reload}>Retry</Button>
          </div>
        )}
        {data && <Table columns={cols} rows={data.tokens} rowKey={(t) => t.id} empty="No API tokens yet." />}
      </Card>

      {revoking && (
        <Modal
          title="Revoke this token?"
          onClose={() => !revokeBusy && setRevoking(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRevoking(null)} disabled={revokeBusy}>Cancel</Button>
              <Button variant="danger" onClick={revoke} disabled={revokeBusy}>{revokeBusy ? 'Revoking…' : 'Revoke token'}</Button>
            </>
          }
        >
          <p class={s.setDesc}>
            <b>{revoking.name}</b> ({revoking.maskedKey}) will stop working immediately. Anything using
            it will start getting authentication errors. This cannot be undone — mint a new token if you
            need one again.
          </p>
        </Modal>
      )}
    </>
  );
}
