import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { BulkActionBar } from '../../../components/BulkActionBar.js';
import { apiClient } from '../../../../AppProviders.js';
import { darkTheme } from '@power-budget/design-tokens';

vi.mock('../../../../AppProviders.js', async () => {
  const { BulkTransactionActions } =
    await import('../../../../application/transactions/BulkTransactionActions.js');
  const client = {
    request: vi.fn(),
    get: vi.fn().mockResolvedValue({ status: 200, data: [], headers: {} }),
    post: vi.fn().mockResolvedValue({ status: 204, data: undefined, headers: {} }),
    put: vi.fn(),
    patch: vi.fn().mockResolvedValue({ status: 200, data: undefined, headers: {} }),
    delete: vi.fn(),
  };

  return { apiClient: client, bulkTransactionActions: new BulkTransactionActions(client) };
});

const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

describe('BulkActionBar', () => {
  const selectedIds = ['tx1', 'tx2', 'tx3'];
  const onMapAll = vi.fn();
  const onClear = vi.fn();
  const onActionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ status: 204, data: undefined, headers: {} });
    mockPatch.mockResolvedValue({ status: 200, data: undefined, headers: {} });
  });

  it('renders nothing when no transactions selected', () => {
    const { container } = render(
      <BulkActionBar selectedIds={[]} onMapAll={onMapAll} onClear={onClear} />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows selected count', () => {
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });
    expect(screen.getByText(/3 selected/)).toBeDefined();
  });

  it('calls onMapAll when "Map all" button is clicked', () => {
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });
    fireEvent.click(screen.getByText(/Map all/i));
    expect(onMapAll).toHaveBeenCalledOnce();
  });

  it('calls onClear when "Clear" button is clicked', () => {
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });
    fireEvent.click(screen.getByText(/Clear/i));
    expect(onClear).toHaveBeenCalledOnce();
  });

  function renderBar(onGone?: () => void): void {
    render(
      <BulkActionBar
        selectedIds={selectedIds}
        onMapAll={onMapAll}
        onClear={onClear}
        onActionComplete={onActionComplete}
        onGone={onGone}
      />,
      { wrapper },
    );
  }

  it('marks the selection as transfers in one bulk request', async () => {
    renderBar();
    fireEvent.click(screen.getByText(/Mark as Transfer/i));
    await waitFor(() => {
      expect(onClear).toHaveBeenCalled();
    });
    expect(mockPost.mock.calls).toEqual([
      ['/transactions/bulk', { ids: ['tx1', 'tx2', 'tx3'], op: 'transfer' }],
    ]);
    expect(onActionComplete).toHaveBeenCalledOnce();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('ignores the selection in one bulk request', async () => {
    renderBar();
    fireEvent.click(screen.getByText(/Ignore/i));
    await waitFor(() => {
      expect(onClear).toHaveBeenCalled();
    });
    expect(mockPost.mock.calls).toEqual([
      ['/transactions/bulk', { ids: ['tx1', 'tx2', 'tx3'], op: 'ignore' }],
    ]);
  });

  it('keeps the selection and shows an error when an action fails', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderBar();
    fireEvent.click(screen.getByText(/Ignore/i));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Some transactions could not be updated. Please try again.',
      );
    });
    expect(onClear).not.toHaveBeenCalled();
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('explains a 409 already_mapped on transfer', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'already_mapped' } } });
    renderBar();
    fireEvent.click(screen.getByText(/Mark as Transfer/i));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Mapped transactions cannot be marked as transfers. Clear their mapping first.',
      );
    });
    expect(onClear).not.toHaveBeenCalled();
  });

  it('hands a 404 (a transaction is no longer the caller’s) to onGone', async () => {
    const onGone = vi.fn();
    mockPost.mockRejectedValueOnce({
      response: { status: 404, data: { code: 'transaction_not_found' } },
    });
    renderBar(onGone);
    fireEvent.click(screen.getByText(/Ignore/i));
    await waitFor(() => {
      expect(onGone).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onActionComplete).not.toHaveBeenCalled();
  });

  it('is a labelled toolbar that reports the count and offers every bulk action', () => {
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });

    const bar = screen.getByRole('toolbar', { name: 'Actions for the selected transactions' });
    expect(bar.getAttribute('data-selected-count')).toBe('3');
    expect(within(bar).getByText(/3 selected/)).toBeDefined();
    expect(within(bar).getAllByRole('button')).toHaveLength(4);
  });

  it('marks the running action busy and disables the buttons meanwhile', async () => {
    mockPost.mockReturnValueOnce(new Promise(() => undefined));
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });

    fireEvent.click(screen.getByText(/Ignore/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ignore/i }).getAttribute('aria-busy')).toBe(
        'true',
      );
    });
    expect(screen.getByRole('button', { name: /Ignore/i })).toHaveProperty('disabled', true);
  });
});
