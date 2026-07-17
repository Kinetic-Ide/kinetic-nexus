import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const post = vi.fn();
const clearToken = vi.fn();

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    POST: (p: string, b?: unknown) => post(p, b),
    clearToken: () => clearToken(),
  };
});

import { Topbar } from './Topbar';

// The health probe drives the pill; each test decides how the gateway answers.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
  post.mockResolvedValue({ success: true });
});

afterEach(() => vi.unstubAllGlobals());

describe('Topbar — identity (7.13b)', () => {
  it('names the signed-in person with their initial and role', async () => {
    // setup.ts seeds an owner identity named "Test Owner".
    render(<Topbar />);
    expect(screen.getByText('Test Owner')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('says plainly when the session is a token, not a person', () => {
    sessionStorage.setItem('nx_identity', JSON.stringify({ role: 'viewer', userId: null, name: null }));
    render(<Topbar />);
    expect(screen.getByText('API token')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});

describe('Topbar — the LIVE pill is real now (7.13b)', () => {
  it('shows LIVE while /health answers', async () => {
    render(<Topbar />);
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/health');
  });

  it('turns grey OFFLINE when the poll fails, instead of glowing through an outage', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    render(<Topbar />);
    await waitFor(() => expect(screen.getByText('OFFLINE')).toBeInTheDocument());
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('treats a non-200 answer as down too', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<Topbar />);
    await waitFor(() => expect(screen.getByText('OFFLINE')).toBeInTheDocument());
  });
});

describe('Topbar — sign out', () => {
  it('kills the session on the server, not just in this browser', async () => {
    // clearToken alone would leave the session alive until TTL — still listed in
    // "Where you're signed in" after the person watched themselves sign out.
    render(<Topbar />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(post).toHaveBeenCalledWith('/admin/logout', undefined);
    expect(clearToken).toHaveBeenCalled();
  });
});
