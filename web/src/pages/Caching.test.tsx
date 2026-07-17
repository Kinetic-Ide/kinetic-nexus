import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const get  = vi.fn();
const put  = vi.fn();
const post = vi.fn();
vi.mock('../api', () => ({
  GET:  (p: string) => get(p),
  PUT:  (p: string, b: unknown) => put(p, b),
  POST: (p: string, b?: unknown) => post(p, b),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; this.name = 'ApiError'; }
  },
}));

import { Caching } from './Caching';

const stats = (over: Record<string, unknown> = {}) => ({
  config: { enabled: true, ttlSeconds: 3600 },
  entries: 42,
  windowDays: 7,
  recent: { hits: 30, requests: 120, hitRate: 0.25, savedUsd: 1.5 },
  ...over,
});

const statsCalls = () => get.mock.calls.filter((c) => String(c[0]).startsWith('/admin/cache/stats')).length;

beforeEach(() => {
  get.mockReset(); put.mockReset(); post.mockReset();
  get.mockImplementation((p: string) => {
    if (p.startsWith('/admin/cache/stats')) return Promise.resolve(stats());
    if (p === '/admin/settings/cache')      return Promise.resolve({ enabled: false, ttlSeconds: 3600 });
    return Promise.resolve({});
  });
  put.mockImplementation((_p: string, b: unknown) => Promise.resolve(b));
  post.mockResolvedValue({ deleted: 42 });
});

describe('Caching — stats', () => {
  it('shows how much is cached, the hit rate, and what it saved', async () => {
    render(<Caching />);
    await waitFor(() => expect(screen.getByText('In cache now')).toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();      // entries
    expect(screen.getByText('25%')).toBeInTheDocument();     // hit rate
    expect(screen.getByText('$1.50')).toBeInTheDocument();   // saved
  });

  it('flags plainly when the cache is switched off', async () => {
    get.mockImplementation((p: string) => p.startsWith('/admin/cache/stats')
      ? Promise.resolve(stats({ config: { enabled: false, ttlSeconds: 3600 } }))
      : Promise.resolve({ enabled: false, ttlSeconds: 3600 }));
    render(<Caching />);
    await waitFor(() => expect(screen.getByText('Cache is off')).toBeInTheDocument());
  });
});

describe('Caching — control (relocated from Settings)', () => {
  it('saves the toggle and TTL, and warns about staleness', async () => {
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('switch', { name: /serve repeat requests from cache/i })).toBeInTheDocument());
    expect(screen.getByText(/Staleness is the trade-off/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: /serve repeat requests from cache/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/settings/cache', { enabled: true, ttlSeconds: 3600 }));
  });

  it('refetches the stats after a save, so the on/off badge flips without a reload (7.13b)', async () => {
    // The header badge reads /admin/cache/stats — a different request from the one the toggle
    // writes. Purge always refreshed it; the toggle never did, leaving a stale badge.
    put.mockResolvedValue({ enabled: true, ttlSeconds: 3600 });
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('switch', { name: /serve repeat requests/i })).toBeInTheDocument());
    const before = statsCalls();

    fireEvent.click(screen.getByRole('switch', { name: /serve repeat requests/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(statsCalls()).toBeGreaterThan(before));
  });

  it('cannot be saved until something actually changed', async () => {
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled());
  });

  it('stops claiming unsaved changes once the save lands', async () => {
    // The control re-seeds from what the gateway says it stored. Without that it would compare the
    // edit against the stale load forever and go on insisting there are unsaved changes. This is the
    // P7.6 SettingsSection regression guard, ported here with the panel it now lives beside.
    put.mockResolvedValue({ enabled: true, ttlSeconds: 3600 });
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('switch', { name: /serve repeat requests/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('switch', { name: /serve repeat requests/i }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /serve repeat requests/i }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Caching — purge', () => {
  it('purges only after a confirm, then reloads the stats', async () => {
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('button', { name: /purge cache/i })).toBeInTheDocument());
    const before = statsCalls();

    fireEvent.click(screen.getByRole('button', { name: /purge cache/i }));   // opens the confirm
    expect(post).not.toHaveBeenCalled();                                     // …but nothing sent yet
    fireEvent.click(screen.getByRole('button', { name: /purge 42 entries/i })); // confirm

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/cache/purge', undefined));
    await waitFor(() => expect(statsCalls()).toBeGreaterThan(before)); // stats refetched
  });

  it('cannot purge an already-empty cache', async () => {
    get.mockImplementation((p: string) => p.startsWith('/admin/cache/stats')
      ? Promise.resolve(stats({ entries: 0 }))
      : Promise.resolve({ enabled: false, ttlSeconds: 3600 }));
    render(<Caching />);
    await waitFor(() => expect(screen.getByRole('button', { name: /purge cache/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /purge cache/i })).toBeDisabled();
  });

  it('offers a VIEWER the stats but neither the toggle save nor the purge (7.13b)', async () => {
    sessionStorage.setItem('nx_identity', JSON.stringify({ role: 'viewer', userId: 'u9', name: 'V' }));
    render(<Caching />);
    await waitFor(() => expect(screen.getAllByText(/hit rate/i).length).toBeGreaterThan(0));

    expect(screen.queryByRole('button', { name: /purge cache/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/read-only access/i).length).toBeGreaterThan(0);
  });
});
