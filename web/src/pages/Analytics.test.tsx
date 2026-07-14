import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { AnalyticsOverview } from '../api';

const get = vi.fn();
vi.mock('../api', () => ({ GET: (p: string) => get(p) }));

import { Analytics } from './Analytics';

const day = (date: string, over: Partial<AnalyticsOverview['byDay'][number]> = {}) => ({
  date, requests: 0, successes: 0, errors: 0, usd: 0, savedUsd: 0, cacheHits: 0, avgLatencyMs: 0, ...over,
});

const payload = (over: Partial<AnalyticsOverview> = {}): AnalyticsOverview => ({
  period: '7d', since: '2026-07-07T00:00:00.000Z', until: '2026-07-14T00:00:00.000Z',
  totals: {
    requests: 100, successes: 90, errors: 10, successRate: 0.9,
    inputTokens: 8000, outputTokens: 2000, totalTokens: 10000, estimatedUsd: 12.5,
    avgLatencyMs: 812, p95LatencyMs: 2000,
    cacheHits: 9, cacheHitRate: 0.1, cacheSavedUsd: 3.25,
  },
  byDay: [day('2026-07-13', { requests: 40, successes: 36, errors: 4, usd: 5, savedUsd: 1.25, cacheHits: 4, avgLatencyMs: 800 }), day('2026-07-14', { requests: 60, successes: 54, errors: 6, usd: 7.5, savedUsd: 2, cacheHits: 5, avgLatencyMs: 820 })],
  byModel:    [{ model: 'gpt-4o', requests: 80, tokens: 9000, usd: 11 }],
  byProvider: [{ provider: 'openai', requests: 100, errors: 10, tokens: 10000, usd: 12.5 }],
  byModality: [{ unit: 'token', requests: 90, quantity: 0, tokens: 10000, usd: 12.5 }],
  byOutcome:  [{ outcome: 'success', requests: 90 }, { outcome: 'upstream_error', requests: 10 }],
  ...over,
});

beforeEach(() => { get.mockReset(); get.mockResolvedValue(payload()); });

describe('Analytics', () => {
  it('shows reliability, latency, spend, and cache savings from one aggregate', async () => {
    render(<Analytics />);
    await waitFor(() => expect(screen.getByText('90.0%')).toBeInTheDocument()); // success rate

    expect(get).toHaveBeenCalledWith('/admin/analytics/overview?period=7d');
    // Latency and cost each appear twice — once as a stat card, once as a chart headline.
    expect(screen.getAllByText('812 ms').length).toBeGreaterThan(0);   // avg latency
    expect(screen.getByText('2K ms')).toBeInTheDocument();             // p95
    expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0);   // cost
    expect(screen.getAllByText('$3.25').length).toBeGreaterThan(0);    // cache saved
  });

  it('refetches when the period changes', async () => {
    render(<Analytics />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('tab', { name: '30 days' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/admin/analytics/overview?period=30d'));
  });

  it('translates outcome slugs into plain English and hides successes from the failure table', async () => {
    render(<Analytics />);
    await waitFor(() => expect(screen.getByText('Provider error')).toBeInTheDocument());
    // "Succeeded" belongs to the success outcome, which the failure table deliberately omits.
    expect(screen.queryByText('Succeeded')).not.toBeInTheDocument();
  });

  it('says the cache saved nothing rather than showing a proud $0', async () => {
    get.mockResolvedValue(payload({
      totals: { ...payload().totals, cacheHits: 0, cacheHitRate: 0, cacheSavedUsd: 0 },
    }));
    render(<Analytics />);
    await waitFor(() => expect(screen.getByText(/Nothing has been served from cache/)).toBeInTheDocument());
  });

  it('tells the operator the window is idle instead of drawing flat lines', async () => {
    get.mockResolvedValue(payload({
      totals: { ...payload().totals, requests: 0, successes: 0, errors: 0, successRate: 0 },
    }));
    render(<Analytics />);
    await waitFor(() => expect(screen.getByText(/No requests in this window/)).toBeInTheDocument());
  });

  it('offers a retry when the aggregate cannot be loaded', async () => {
    get.mockRejectedValue(new Error('boom'));
    render(<Analytics />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());
    expect(screen.getByText(/Couldn’t load analytics/)).toBeInTheDocument();
  });
});
