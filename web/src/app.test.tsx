import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { setToken } from './api';
import { App } from './app';

describe('App', () => {
  // The app is behind a sign-in gate (Phase 7.9b); seed a session token so the smoke test exercises the
  // signed-in shell rather than the login screen. The LIVE pill polls /health for real since 7.13b, so
  // give it a healthy gateway to find.
  beforeEach(() => {
    setToken('test-session-token');
    // Only the health probe gets an answer; every data fetch fails into its page's error state,
    // exactly as before — an empty 200 would send Overview destructuring a body that isn't there.
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/health'
      ? Promise.resolve({ ok: true })
      : Promise.reject(new Error('no gateway in this test')))));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mounts the shell and lands on Overview', async () => {
    render(<App />);
    // Shell chrome — the pill appears once the first health probe answers.
    expect(screen.getByText('Alayra Nexus')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument());
    // Overview landing content (subtitle is unique to the page, not the nav)
    expect(screen.getByText('Real-time gateway telemetry')).toBeInTheDocument();
  });
});
