import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import type { NexusOverview } from '../api';

const useApi = vi.fn();
vi.mock('../hooks/useApi', () => ({ useApi: () => useApi() }));

import { Nexus } from './Nexus';

const sample: NexusOverview = {
  summary: { providers: 1, activeKeys: 1, coolingKeys: 0, bannedKeys: 1, totalKeys: 2 },
  routing: { costWeight: 0.3 },
  tiers: [{
    tier: 'standard',
    providers: [{
      id: 'p1', name: 'OpenAI Prod', slug: 'openai-prod', provider: 'openai', tier: 'standard', preferredModel: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1', modelFetchUrl: null, authHeader: 'Authorization', authPrefix: 'Bearer', modelIdPath: 'data[].id', extraHeaders: {},
      keys: [{ id: 'k1', maskedKey: 'sk-…1', label: null, status: 'active', coolingUntil: null, rpmLimit: 60, tpmLimit: 100000, maxUsers: 1000, ownerTeamName: null, lastUsedAt: null }],
    }],
  }],
};

beforeEach(() => vi.clearAllMocks());

describe('Nexus', () => {
  it('shows an error state with retry', () => {
    useApi.mockReturnValue({ data: null, loading: false, error: 'HTTP 500', reload: vi.fn() });
    render(<Nexus />);
    expect(screen.getByText(/Couldn’t load pools/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders pools, keys, and the honest routing rules', () => {
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    render(<Nexus />);
    expect(screen.getByText('How requests are routed')).toBeInTheDocument();
    expect(screen.getByText(/not yet enforced by routing/i)).toBeInTheDocument(); // the honest assignedTier note
    expect(screen.getByText('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByText('sk-…1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test' })).toBeInTheDocument();
  });

  it('shows a viewer the pools with no way to touch them (7.13b)', () => {
    sessionStorage.setItem('nx_identity', JSON.stringify({ role: 'viewer', userId: 'u9', name: 'V' }));
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    render(<Nexus />);
    // The pool and its key health are still there to read…
    expect(screen.getByText('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByText('sk-…1')).toBeInTheDocument();
    // …but nothing that would change them: no add-provider, no per-pool or per-key actions.
    expect(screen.queryByRole('button', { name: /add provider/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit pool/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove pool/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
