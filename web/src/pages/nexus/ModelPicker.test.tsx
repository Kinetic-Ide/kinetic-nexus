import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ModelPicker } from './ModelPicker';
import type { FetchedModel } from '../../api';

// Pure-props component — no api mock needed. These pin the behaviours that undo the old
// "339 selected chips" dialog: opt-in default, search, bulk select, and the 4-chip strip.

const MODELS: FetchedModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  { id: 'claude-sonnet', name: 'Claude Sonnet' },
  { id: 'llama-3', name: 'Llama 3' },
  { id: 'mistral-large', name: 'Mistral Large' },
  { id: 'gemma-7b', name: 'Gemma 7B' },
];

function setup(selected: string[] = []) {
  const onChange = vi.fn();
  render(<ModelPicker models={MODELS} selected={selected} onChange={onChange} />);
  return onChange;
}

// The row's accessible name is the concatenated spans ("gpt-4oGPT-4o$2.5 / $10…"), so anchor the
// id at the start and require the next character to be non-id-like — "gpt-4o" must not also match
// the "gpt-4o-mini" row.
const row = (id: string) => screen.getByRole('button', { name: new RegExp(`^${id}(?![a-z0-9-])`) });

describe('ModelPicker', () => {
  it('starts with nothing selected — every row reads unpressed, no strip', () => {
    setup();
    for (const m of MODELS) expect(row(m.id)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText(/^Deselect/)).toBeNull();
    expect(screen.getByText('6 of 6')).toBeInTheDocument();
  });

  it('clicking a row selects it; clicking again deselects', () => {
    const onChange = setup(['gpt-4o']);
    expect(row('claude-sonnet')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(row('claude-sonnet'));
    expect(onChange).toHaveBeenLastCalledWith(['gpt-4o', 'claude-sonnet']);
    fireEvent.click(row('gpt-4o'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows harvested pricing and context on the row', () => {
    setup();
    expect(screen.getByText('$2.5 / $10')).toBeInTheDocument();
    expect(screen.getByText('128k ctx')).toBeInTheDocument();
    expect(screen.getByText('$0.15 / $0.6')).toBeInTheDocument();
  });

  it('multi-token search narrows the list ("4o mini" finds gpt-4o-mini)', () => {
    setup();
    fireEvent.input(screen.getByLabelText('Search models'), { target: { value: '4o mini' } });
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    expect(row('gpt-4o-mini')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claude-sonnet/ })).toBeNull();
  });

  it('"Select all N shown" adds exactly the filtered, unselected ids', () => {
    const onChange = setup(['gpt-4o']);
    fireEvent.input(screen.getByLabelText('Search models'), { target: { value: 'gpt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select all 1 shown' }));
    expect(onChange).toHaveBeenLastCalledWith(['gpt-4o', 'gpt-4o-mini']);
  });

  it('"Clear" empties the selection', () => {
    const onChange = setup(['gpt-4o', 'llama-3']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear (2)' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('strip shows 4 chips + "+N more", expands to all, and collapses back', () => {
    setup(['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'llama-3', 'mistral-large']);
    // Collapsed: exactly 4 deselect chips + the overflow control.
    expect(screen.getAllByLabelText(/^Deselect/)).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    expect(screen.getAllByLabelText(/^Deselect/)).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByLabelText(/^Deselect/)).toHaveLength(4);
  });

  it('a chip × deselects that model', () => {
    const onChange = setup(['gpt-4o', 'llama-3']);
    fireEvent.click(screen.getByLabelText('Deselect llama-3'));
    expect(onChange).toHaveBeenLastCalledWith(['gpt-4o']);
  });

  it('no strip control claims more than exist — ≤4 selected shows plain chips only', () => {
    setup(['gpt-4o', 'llama-3']);
    expect(screen.getAllByLabelText(/^Deselect/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show less' })).toBeNull();
  });
});
