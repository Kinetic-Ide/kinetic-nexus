import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { AiModel } from '../../api';

const update = vi.fn();
vi.mock('../../lib/registry', () => ({ updateModelInRegistry: (m: AiModel) => update(m) }));

const match = vi.fn();
vi.mock('../../lib/catalog', () => ({
  loadPricingCatalog: () => Promise.resolve([]),
  matchCatalog: (...a: unknown[]) => match(...a),
}));

import { EditModelDialog } from './EditModelDialog';

const model: AiModel = {
  id: 'openai-gpt-4o', displayName: 'gpt-4o', provider: 'openai', modelString: 'gpt-4o', tier: 'standard', status: 'active',
  priority: 1, capabilities: ['chat'], hasVision: false, hasFIM: false, hasToolCalling: false,
  inputCostPer1M: 0, outputCostPer1M: 0, imagePrice: 0, speechPricePer1MChars: 0, transcriptionPrice: 0,
  audioInputPer1M: 0, audioOutputPer1M: 0, contextWindow: 0, maxTokens: 0,
};

beforeEach(() => { update.mockReset(); update.mockResolvedValue(undefined); match.mockReset(); });

describe('EditModelDialog', () => {
  it('shows token pricing for a chat model and saves edits to the registry', async () => {
    render(<EditModelDialog model={model} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getAllByText('$ / 1M tokens').length).toBeGreaterThan(0); // token pricing visible for chat

    fireEvent.click(screen.getByRole('button', { name: /save model/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'openai-gpt-4o', capabilities: ['chat'] });
  });

  it('auto-fills pricing from a catalog match', async () => {
    match.mockReturnValue({ displayName: 'GPT-4o', capabilities: ['chat'], inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000, maxTokens: 16384 });
    render(<EditModelDialog model={model} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /auto-fill pricing/i }));
    expect(await screen.findByText(/Filled from “GPT-4o”/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save model/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toMatchObject({ inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000 });
  });
});
