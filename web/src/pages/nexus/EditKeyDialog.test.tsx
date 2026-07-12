import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { NexusKeyHealth } from '../../api';

const patch = vi.fn();
vi.mock('../../api', () => ({
  PATCH: (path: string, body: unknown) => patch(path, body),
  ApiError: class ApiError extends Error {},
}));

import { EditKeyDialog } from './EditKeyDialog';

const key: NexusKeyHealth = {
  id: 'key-1', maskedKey: 'sk-…abcd', label: 'primary', status: 'active', coolingUntil: null,
  rpmLimit: 60, tpmLimit: 100000, maxUsers: 1000, ownerTeamName: null, lastUsedAt: null,
};

beforeEach(() => { patch.mockReset(); patch.mockResolvedValue({ key }); });

describe('EditKeyDialog', () => {
  it('prefills the current values and PATCHes only the edited fields', async () => {
    render(<EditKeyDialog k={key} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect((screen.getByDisplayValue('primary') as HTMLInputElement).value).toBe('primary');
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument(); // max users prefilled

    fireEvent.input(screen.getByDisplayValue('1000'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /save key/i }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/keys/key-1');
    expect(patch.mock.calls[0][1]).toMatchObject({ label: 'primary', maxUsers: 250, rpmLimit: 60, tpmLimit: 100000 });
    // No key replacement was entered, so apiKey must not be sent.
    expect(patch.mock.calls[0][1]).not.toHaveProperty('apiKey');
  });

  it('sends apiKey only when a replacement is entered', async () => {
    render(<EditKeyDialog k={key} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-new-value' } });
    fireEvent.click(screen.getByRole('button', { name: /save key/i }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).toMatchObject({ apiKey: 'sk-new-value' });
  });
});
