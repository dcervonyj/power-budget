import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { MappingModal } from '../../../components/MappingModal.js';
import { apiClient } from '../../../../AppProviders.js';
import { darkTheme } from '@power-budget/design-tokens';

vi.mock('../../../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ status: 200, data: {}, headers: {} }),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

const mockPlans = [
  { id: 'plan-1', name: 'May Budget', status: 'active' as const },
  { id: 'plan-2', name: 'June Budget', status: 'active' as const },
];

const mockItems = [
  {
    id: 'item-1',
    planId: 'plan-1',
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    direction: 'expense' as const,
    amountMinor: 50000,
    currency: 'EUR',
  },
  {
    id: 'item-2',
    planId: 'plan-1',
    categoryId: 'cat-2',
    categoryName: 'Transport',
    direction: 'expense' as const,
    amountMinor: 20000,
    currency: 'EUR',
  },
];

describe('MappingModal', () => {
  const selectedIds = ['tx1', 'tx2'];
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ status: 200, data: {}, headers: {} });
    mockGet.mockImplementation((url: string) => {
      if (url === '/plans?status=active') {
        return Promise.resolve({ status: 200, data: mockPlans, headers: {} });
      }
      if (url === '/plans/plan-1/items') {
        return Promise.resolve({ status: 200, data: mockItems, headers: {} });
      }
      return Promise.resolve({ status: 200, data: [], headers: {} });
    });
  });

  it('does not render when closed', () => {
    render(
      <MappingModal
        isOpen={false}
        selectedIds={selectedIds}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('loads and shows active plans when opened', async () => {
    render(
      <MappingModal isOpen selectedIds={selectedIds} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('May Budget')).toBeDefined();
    });
    expect(screen.getByText('June Budget')).toBeDefined();
    expect(mockGet).toHaveBeenCalledWith('/plans?status=active');
  });

  it('loads planned items when plan is selected', async () => {
    render(
      <MappingModal isOpen selectedIds={selectedIds} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeDefined();
    });
    expect(screen.getByText('Transport')).toBeDefined();
    expect(mockGet).toHaveBeenCalledWith('/plans/plan-1/items');
  });

  it('shows "Suggested" badge on the first planned item', async () => {
    render(
      <MappingModal isOpen selectedIds={selectedIds} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Suggested')).toBeDefined();
    });

    const allItems = screen.getAllByRole('radio');
    expect(allItems.length).toBe(2);
  });

  it('calls POST /transactions/bulk with map action on confirm', async () => {
    render(
      <MappingModal isOpen selectedIds={selectedIds} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Map \(/i));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/transactions/bulk', {
        action: 'map',
        ids: selectedIds,
        plannedItemId: 'item-1',
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(
      <MappingModal isOpen selectedIds={selectedIds} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
