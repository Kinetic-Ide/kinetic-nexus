import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { POST, ApiError } from '../../api';
import { Card, Button, Modal, FormError } from '../../ui';
import { canWrite } from '../../lib/access';
import s from '../pages.module.css';

// Empty the response cache. This is a blunt instrument by design: every namespace shares one Redis
// prefix, so there is no per-team purge — clearing it clears the shared pool and every team at once.
// That is stated plainly in the confirm step, because the only cost of a purge is that the next
// identical requests are paid for again, and the operator should decide that knowingly.
export function PurgeCard({ entries, onPurged }: { entries: number; onPurged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [done, setDone]             = useState<number | null>(null);

  const purge = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { deleted } = await POST<{ deleted: number }>('/admin/cache/purge');
      setDone(deleted);
      setConfirming(false);
      onPurged();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403
        ? 'Your session is read-only (viewer). An owner credential is required to purge the cache.'
        : err instanceof ApiError ? err.message : 'Could not purge the cache.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card heading="Purge">
      <p class={s.setDesc}>
        Remove every cached response. The cache rebuilds itself as new requests come in; nothing else
        is affected.
      </p>
      {done !== null && <p class={s.purgeDone}>Cleared {done.toLocaleString()} cached {done === 1 ? 'entry' : 'entries'}.</p>}
      {canWrite() ? (
        <>
          <Button variant="danger" size="sm" onClick={() => { setDone(null); setError(null); setConfirming(true); }} disabled={entries === 0}>
            <Trash2 size={13} /> Purge cache
          </Button>
          {entries === 0 && <span class={s.purgeEmpty}>The cache is already empty.</span>}
        </>
      ) : (
        <span class={s.purgeEmpty}>You have read-only access.</span>
      )}

      {confirming && (
        <Modal
          title="Purge the response cache?"
          onClose={() => !busy && setConfirming(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={purge} disabled={busy}>{busy ? 'Purging…' : `Purge ${entries.toLocaleString()} entries`}</Button>
            </>
          }
        >
          {error && <FormError>{error}</FormError>}
          <p class={s.setDesc}>
            This clears <b>all {entries.toLocaleString()}</b> cached responses — the shared pool <b>and
            every team</b> (there is no per-team purge; the team is part of each entry's hidden key).
          </p>
          <p class={s.setDesc}>
            Nothing breaks. The next time each of those requests is made it will be answered by a
            provider and paid for again, then cached afresh.
          </p>
        </Modal>
      )}
    </Card>
  );
}
