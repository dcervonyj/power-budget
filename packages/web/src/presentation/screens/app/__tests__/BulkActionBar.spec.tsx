import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { BulkActionBar } from '../../../components/BulkActionBar.js';
import { apiClient } from '../../../../AppProviders.js';
import { darkTheme } from '@power-budget/design-tokens';

vi.mock('../../../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockPost = vi.mocked(apiClient.post);

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
    mockPost.mockResolvedValue({ data: {} });
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

  it('calls POST /transactions/bulk with mark_transfer action', async () => {
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
      expect(mockPost).toHaveBeenCalledWith('/transactions/bulk', {
        action: 'mark_transfer',
        ids: selectedIds,
      });
    });
    await waitFor(() => {
      expect(onActionComplete).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onClear).toHaveBeenCalled();
    });
  });

  it('calls POST /transactions/bulk with ignore action', async () => {
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
      expect(mockPost).toHaveBeenCalledWith('/transactions/bulk', {
        action: 'ignore',
        ids: selectedIds,
      });
    });
  });
});
