import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const post = vi.fn();
const get = vi.fn();
const put = vi.fn();
const fetchModels = vi.fn();
vi.mock('../../api', () => ({
  POST: (p: string, b: unknown) => post(p, b),
  GET: (p: string) => get(p),
  PUT: (p: string, b?: unknown) => put(p, b),
  fetchProviderModels: (id: string, key?: string) => fetchModels(id, key),
  ApiError: class ApiError extends Error {},
}));

import { AddKeyDialog } from './AddKeyDialog';

const props = { providerId: 'p1', providerName: 'OpenRouter Prod', provider: 'openrouter', tier: 'standard' };

// What the harvest now returns: objects with pricing, not bare id strings.
const FETCHED = [
  { id: 'gpt-4o', name: 'GPT-4o', inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  { id: 'claude-sonnet', name: 'Claude Sonnet' },
];

beforeEach(() => {
  post.mockReset(); post.mockResolvedValue({});
  get.mockReset(); get.mockResolvedValue({ models: [] });
  put.mockReset(); put.mockResolvedValue({});
  fetchModels.mockReset();
});

const enterKeyAndFetch = async () => {
  fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-secret' } });
  fireEvent.click(screen.getByRole('button', { name: /fetch models/i }));
  await waitFor(() => expect(screen.getByText(/3 of 3/)).toBeInTheDocument());
};

describe('AddKeyDialog', () => {
  it('posts the key to the pool with numeric limits', async () => {
    const onChanged = vi.fn();
    render(<AddKeyDialog {...props} onClose={vi.fn()} onChanged={onChanged} />);

    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /^add key$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/admin/providers/p1/keys');
    expect(body).toMatchObject({ apiKey: 'sk-secret', rpmLimit: 60, tpmLimit: 100000, maxUsers: 1000 });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('fetch shows the picker with NOTHING selected — the opt-in flip', async () => {
    fetchModels.mockResolvedValue({ models: FETCHED });
    render(<AddKeyDialog {...props} onClose={vi.fn()} onChanged={vi.fn()} />);

    await enterKeyAndFetch();
    expect(fetchModels).toHaveBeenCalledWith('p1', 'sk-secret');
    expect(screen.getByText('Models (0/3 selected)')).toBeInTheDocument();
    // No selection chips exist yet; saving now must not touch the registry.
    expect(screen.queryByLabelText(/^Deselect/)).toBeNull();
  });

  it('saving selected models writes them to the registry WITH harvested pricing', async () => {
    fetchModels.mockResolvedValue({ models: FETCHED });
    const onChanged = vi.fn();
    render(<AddKeyDialog {...props} onClose={vi.fn()} onChanged={onChanged} />);

    await enterKeyAndFetch();
    fireEvent.click(screen.getByRole('button', { name: /^gpt-4o(?![a-z0-9-])/ }));
    fireEvent.click(screen.getByRole('button', { name: /^claude-sonnet(?![a-z0-9-])/ }));
    expect(screen.getByText('Models (2/3 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^add key$/i }));
    await waitFor(() => expect(put).toHaveBeenCalled());

    const payload = put.mock.calls[0][1] as { models: Array<Record<string, unknown>> };
    expect(payload.models).toHaveLength(2);
    expect(payload.models[0]).toMatchObject({
      provider: 'openrouter', modelString: 'gpt-4o', displayName: 'GPT-4o',
      inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000, tier: 'standard',
    });
    expect(payload.models[1]).toMatchObject({ modelString: 'claude-sonnet', displayName: 'Claude Sonnet' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('saving with nothing selected posts the key but never touches the registry', async () => {
    fetchModels.mockResolvedValue({ models: FETCHED });
    render(<AddKeyDialog {...props} onClose={vi.fn()} onChanged={vi.fn()} />);

    await enterKeyAndFetch();
    fireEvent.click(screen.getByRole('button', { name: /^add key$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('disables the submit until a key is entered', () => {
    render(<AddKeyDialog {...props} onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^add key$/i })).toBeDisabled();
  });
});
