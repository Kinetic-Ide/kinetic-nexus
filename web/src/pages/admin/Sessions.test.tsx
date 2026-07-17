import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { SessionsResponse } from '../../api';

const useApi = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: (p: string) => useApi(p) }));
vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    POST: (p: string, b?: unknown) => post(p, b),
    DEL: (p: string) => del(p),
  };
});

import { Sessions } from './Sessions';

const NOW = Date.now();

const two: SessionsResponse = {
  sessions: [
    {
      id: 'aaa', browser: 'Chrome on Windows', userAgent: 'Mozilla/5.0 ... Chrome',
      ip: '203.0.113.7', createdAt: NOW - 3_600_000, lastSeenAt: NOW, current: true,
    },
    {
      id: 'bbb', browser: 'Safari on macOS', userAgent: 'Mozilla/5.0 ... Safari',
      ip: '198.51.100.4', createdAt: NOW - 86_400_000, lastSeenAt: NOW - 7_200_000, current: false,
    },
  ],
};

const one: SessionsResponse = { sessions: [two.sessions[0]] };

function primeApi(data: SessionsResponse) {
  useApi.mockImplementation((path: string) => {
    if (path === '/admin/me/sessions') return { data, loading: false, error: null, reload: vi.fn() };
    return { data: null, loading: false, error: null, reload: vi.fn() };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ success: true, revoked: 1 });
  del.mockResolvedValue({ success: true });
});

describe('Sessions — where you are signed in', () => {
  it('lists each session with its device, IP, and marks the one you are reading through', async () => {
    primeApi(two);
    render(<Sessions />);
    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeInTheDocument());

    expect(screen.getByText('Safari on macOS')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
    expect(screen.getByText('198.51.100.4')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
  });

  it('offers Sign out on every session except the current one', async () => {
    primeApi(two);
    render(<Sessions />);
    await waitFor(() => expect(screen.getByText('Safari on macOS')).toBeInTheDocument());

    // Exactly one revoke button — the Safari row. The current row explains itself instead:
    // revoking the session you are using is the sidebar's Sign out, not a row action.
    const buttons = screen.getAllByRole('button', { name: /^sign out$/i });
    expect(buttons).toHaveLength(1);
    expect(screen.getByText(/use sign out in the sidebar/i)).toBeInTheDocument();

    fireEvent.click(buttons[0]);
    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/me/sessions/bbb'));
  });

  it('signs out everywhere else in one click', async () => {
    primeApi(two);
    render(<Sessions />);
    await waitFor(() => expect(screen.getByText('Safari on macOS')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /sign out everywhere else/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/me/sessions/revoke-others', undefined));
  });

  it('with a single session, says so and offers no bulk action', async () => {
    // "Sign out everywhere else" with nowhere else to sign out of would be a button that
    // does nothing — absence is the honest state.
    primeApi(one);
    render(<Sessions />);
    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /everywhere else/i })).not.toBeInTheDocument();
    expect(screen.getByText('Only this device')).toBeInTheDocument();
  });

  it('surfaces a failed revoke instead of pretending', async () => {
    primeApi(two);
    del.mockRejectedValue(new Error('No such session.'));
    render(<Sessions />);
    await waitFor(() => expect(screen.getByText('Safari on macOS')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
    await waitFor(() => expect(screen.getByText('No such session.')).toBeInTheDocument());
  });
});
