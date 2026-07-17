import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const post = vi.fn();
const clearToken = vi.fn();

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    POST: (p: string, b?: unknown) => post(p, b),
    clearToken: () => clearToken(),
  };
});

import { DangerZone } from './DangerZone';

// jsdom's location.assign throws "Not implemented" — replace it so a successful reset
// can be observed instead of crashing the test.
const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign },
    writable: true,
  });
});

const master = () => screen.getByLabelText(/administrator master password/i);
const phrase = () => screen.getByLabelText(/type reset this gateway/i);
const button = () => screen.getByRole('button', { name: /erase everything/i });

describe('DangerZone — factory reset', () => {
  it('keeps the button disabled until both proofs are typed, and the phrase exactly', () => {
    render(<DangerZone />);
    expect(button()).toBeDisabled();

    // The password alone is not enough…
    fireEvent.input(master(), { target: { value: 'the-master-password' } });
    expect(button()).toBeDisabled();

    // …and neither is a nearly-right phrase. Case counts: typing it exactly is the point.
    fireEvent.input(phrase(), { target: { value: 'reset this gateway' } });
    expect(button()).toBeDisabled();

    fireEvent.input(phrase(), { target: { value: 'RESET THIS GATEWAY' } });
    expect(button()).toBeEnabled();
  });

  it('sends both proofs, then drops the dead token and reloads into first-run', async () => {
    post.mockResolvedValue({ success: true, tablesCleared: 15, redisKeysCleared: 3 });
    render(<DangerZone />);

    fireEvent.input(master(), { target: { value: 'the-master-password' } });
    fireEvent.input(phrase(), { target: { value: 'RESET THIS GATEWAY' } });
    fireEvent.click(button());

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/setup/reset', {
      masterPassword: 'the-master-password',
      confirm: 'RESET THIS GATEWAY',
    }));
    // The reset destroyed the session this request rode in on — keeping the token would leave
    // every panel stuck on 401. Clear it and land on the root, where the app finds the
    // unclaimed gateway and shows first-run.
    await waitFor(() => expect(clearToken).toHaveBeenCalled());
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('shows the gateway’s refusal and lets the owner try again', async () => {
    post.mockRejectedValue(new Error('That is not the administrator password from your server’s environment.'));
    render(<DangerZone />);

    fireEvent.input(master(), { target: { value: 'wrong' } });
    fireEvent.input(phrase(), { target: { value: 'RESET THIS GATEWAY' } });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByText(/not the administrator password/i)).toBeInTheDocument());
    // Nothing was reset: the token survives and the form is live again.
    expect(clearToken).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(button()).toBeEnabled();
  });

  it('states the blast radius before asking for anything', () => {
    // The description is part of the control: someone should learn the audit trail dies
    // BEFORE typing the phrase, not from the empty page after.
    render(<DangerZone />);
    expect(screen.getByText(/providers and their keys/i)).toBeInTheDocument();
    expect(screen.getByText(/audit trail itself/i)).toBeInTheDocument();
    expect(screen.getByText(/no undo/i)).toBeInTheDocument();
  });
});
