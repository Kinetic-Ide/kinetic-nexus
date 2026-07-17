import { useState } from 'preact/hooks';
import { TriangleAlert } from 'lucide-preact';
import { POST, clearToken } from '../../api';
import { Card, Button, Field, Input, FormError } from '../../ui';
import s from './admin.module.css';

// The Danger zone (Phase 7.13b) — one card, one action, and the action is total.
//
// The form demands the two proofs the server will check anyway: the MASTER PASSWORD from the
// server's environment (the same secret the first-run claim demanded — un-claiming is claiming's
// mirror) and the TYPED PHRASE (you are doing this on purpose, not autocompleting a dialog).
// The third proof, an owner session, is who gets to see this tab at all.
//
// Nothing here soft-guards the server: a viewer who forges their way to this form still holds
// neither an owner session nor the master password.

const PHRASE = 'RESET THIS GATEWAY';

export function DangerZone() {
  const [master, setMaster] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phraseOk = confirm === PHRASE;

  const reset = async (e: Event) => {
    e.preventDefault();
    if (busy || !phraseOk || !master) return;
    setBusy(true); setError(null);
    try {
      await POST('/admin/setup/reset', { masterPassword: master, confirm });
      // Everything is gone, including the session this request rode in on. Drop the dead token
      // and go to the root — where the app will find an unclaimed gateway and show the first-run
      // screen. Not reload(): that would re-request /admin, which is the API prefix, not a page.
      clearToken();
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The gateway refused the reset.');
      setBusy(false);
    }
  };

  return (
    <Card>
      <div class={s.head}>
        <div class={s.headText}>
          <span class={s.headTitle}><TriangleAlert size={15} class={s.dangerIcon} /> Factory reset</span>
          <span class={s.headSub}>
            Erases everything this gateway knows: providers and their keys, teams, usage history,
            people and their accounts, settings, and the audit trail itself. Signs everyone out.
            The gateway returns to its first-run state, waiting to be claimed — there is no undo
            and no backup made on your behalf.
          </span>
        </div>
      </div>

      {error && <FormError>{error}</FormError>}

      <form class={s.forms} onSubmit={reset}>
        <Field
          label="Administrator master password"
          hint="ADMIN_PASSWORD from the server's environment — the same secret that claimed this gateway."
        >
          <Input
            type="password"
            value={master}
            autoComplete="off"
            onInput={(e) => setMaster((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label={`Type ${PHRASE} to confirm`}>
          <Input
            type="text"
            value={confirm}
            autoComplete="off"
            placeholder={PHRASE}
            onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
          />
        </Field>
        <div>
          <Button variant="danger" type="submit" disabled={busy || !phraseOk || !master}>
            {busy ? 'Erasing…' : 'Erase everything and reset'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
