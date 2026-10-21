import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('marks each selected transaction as a transfer (bulk op transfer is a no-op in the API)', async () => {
    render(
      <BulkActionBar
        selectedIds={selectedIds}
        onMapAll={onMapAll}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByText(/Mark as Transfer/i));
    await waitFor(() => {
      expect(mockPost.mock.calls).toEqual([
        ['/transactions/tx1/transfer', {}],
        ['/transactions/tx2/transfer', {}],
        ['/transactions/tx3/transfer', {}],
      ]);
    });
    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onClear).toHaveBeenCalled();
    });
  });

  it('patches each selected transaction as ignored', async () => {
    render(
      <BulkActionBar
        selectedIds={selectedIds}
        onMapAll={onMapAll}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByText(/Ignore/i));
    await waitFor(() => {
      expect(mockPatch.mock.calls).toEqual([
        ['/transactions/tx1', { ignored: true }],
        ['/transactions/tx2', { ignored: true }],
        ['/transactions/tx3', { ignored: true }],
      ]);
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('keeps the selection and shows an error when an action fails', async () => {
    mockPatch.mockRejectedValueOnce(new Error('500'));
    render(
      <BulkActionBar
        selectedIds={selectedIds}
        onMapAll={onMapAll}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByText(/Ignore/i));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(onClear).not.toHaveBeenCalled();
  });

  it('wraps on narrow widths instead of overflowing horizontally', () => {
    render(<BulkActionBar selectedIds={selectedIds} onMapAll={onMapAll} onClear={onClear} />, {
      wrapper,
    });

    const bar = screen.getByText(/3 selected/).parentElement;
    expect(bar?.style.flexWrap).toBe('wrap');
    expect(bar?.style.maxWidth).toBe('100%');
  });
});
