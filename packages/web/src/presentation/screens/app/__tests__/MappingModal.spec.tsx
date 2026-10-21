import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { MappingModal } from '../../../components/MappingModal.js';
import { apiClient } from '../../../../AppProviders.js';
import { darkTheme } from '@power-budget/design-tokens';

vi.mock('../../../../AppProviders.js', async () => {
  const { BulkTransactionActions } =
    await import('../../../../application/transactions/BulkTransactionActions.js');
  const { PlansApi } = await import('@power-budget/shared-app');
  const client = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ status: 204, data: undefined, headers: {} }),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return {
    apiClient: client,
    bulkTransactionActions: new BulkTransactionActions(client),
    plansApi: new PlansApi(client),
  };
});

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

function planDto(id: string, name: string) {
  return {
    id,
    name,
    type: 'personal' as const,
    ownerUserId: 'u1',
    periodKind: 'monthly' as const,
    period: { start: '2026-10-01', end: '2026-10-31' },
    baseCurrency: 'EUR',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function itemDto(id: string, categoryId: string, amountMinor: string) {
  return {
    id,
    planId: 'plan-1',
    categoryId,
    direction: 'expense' as const,
    amount: { amountMinor, currency: 'EUR' },
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

// CLN-011 shapes: plans with period/archivedAt, items with `amount` and no category name.
const mockPlans = [planDto('plan-1', 'May Budget'), planDto('plan-2', 'June Budget')];

const mockItems = [itemDto('item-1', 'cat-1', '50000'), itemDto('item-2', 'cat-2', '20000')];

const mockCategories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Transport' },
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
      if (url === '/categories?includeArchived=true') {
        return Promise.resolve({ status: 200, data: mockCategories, headers: {} });
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

  it('calls POST /transactions/bulk with the op/payload body the API validates', async () => {
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
        ids: selectedIds,
        op: 'map',
        payload: { plannedItemId: 'item-1' },
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
