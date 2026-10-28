import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  HouseholdDashboardCategoryDto,
  HouseholdMemberResponseDto,
} from '@power-budget/shared-app/contract';
import { HouseholdStore } from '../../../../application/household/HouseholdStore.js';
import { HouseholdMembersCard } from '../HouseholdMembersCard.js';
import { HouseholdAggregatesCard } from '../HouseholdAggregatesCard.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { PLAN, apiError } from '../../../../test/dashboardFixtures.js';

const OWNER: HouseholdMemberResponseDto = {
  userId: 'user-ann',
  email: 'ann@example.com',
  displayName: 'Ann',
  role: 'owner',
  joinedAt: '2026-10-01T10:00:00.000Z',
};
const PARTNER: HouseholdMemberResponseDto = {
  userId: 'user-bob',
  email: 'bob@example.com',
  displayName: '',
  role: 'member',
  joinedAt: '2026-10-20T10:00:00.000Z',
};

function aggregate(
  categoryName: string,
  privacyLevel: HouseholdDashboardCategoryDto['privacyLevel'],
  totalAmountMinor: string,
  transactionCount: number,
): HouseholdDashboardCategoryDto {
  return {
    categoryId: `cat-${categoryName}`,
    categoryName,
    privacyLevel,
    totalAmountMinor,
    currency: 'PLN',
    transactionCount,
  };
}

function makeApi() {
  return {
    members: vi.fn().mockResolvedValue([OWNER]),
    invites: vi.fn().mockResolvedValue([]),
    invite: vi.fn().mockResolvedValue(undefined),
    resendInvite: vi.fn().mockResolvedValue(undefined),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    dashboard: vi.fn().mockResolvedValue({
      planId: 'plan-1',
      categories: [
        aggregate('Groceries', 'total_only', '150000', 7),
        aggregate('Fuel', 'total_with_counts', '42000', 3),
        aggregate('Kids', 'full_detail', '9900', 1),
      ],
    }),
  };
}

describe('household cards', () => {
  let api: ReturnType<typeof makeApi>;
  let store: HouseholdStore;

  beforeEach(() => {
    api = makeApi();
    store = new HouseholdStore(api, { list: vi.fn().mockResolvedValue([PLAN]) });
  });

  it('lets the owner invite the partner by email', async () => {
    await store.load('user-ann', 'hh-1');
    api.invites.mockResolvedValue([
      {
        id: 'invite-1',
        email: 'bob@example.com',
        status: 'pending',
        expiresAt: '2026-10-28T12:00:00.000Z',
        createdAt: '2026-10-21T12:00:00.000Z',
      },
    ]);
    renderWithProviders(<HouseholdMembersCard store={store} />);

    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Partner's email"), {
      target: { value: 'bob@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invite partner' }));

    expect(await screen.findByText('Invite sent.')).toBeInTheDocument();
    expect(api.invite).toHaveBeenCalledWith('bob@example.com');
    expect(screen.getByText('Invite pending, valid until 28 Oct 2026')).toBeInTheDocument();
    expect(screen.getByLabelText("Partner's email")).toHaveValue('');
  });

  it('resends and revokes the open invite', async () => {
    api.invites.mockResolvedValue([
      {
        id: 'invite-1',
        email: 'bob@example.com',
        status: 'expired',
        expiresAt: '2026-10-14T12:00:00.000Z',
        createdAt: '2026-10-07T12:00:00.000Z',
      },
    ]);
    await store.load('user-ann', 'hh-1');
    renderWithProviders(<HouseholdMembersCard store={store} />);

    expect(screen.getByText('Invite expired on 14 Oct 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend invite' }));
    expect(
      await screen.findByText('Invite sent again. The previous link no longer works.'),
    ).toBeInTheDocument();
    expect(api.resendInvite).toHaveBeenCalledWith('invite-1');

    api.invites.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke invite' }));
    expect(await screen.findByText('Invite revoked.')).toBeInTheDocument();
    expect(api.revokeInvite).toHaveBeenCalledWith('invite-1');
    expect(screen.queryByRole('button', { name: 'Revoke invite' })).toBeNull();
  });

  it('shows why an invite failed', async () => {
    await store.load('user-ann', 'hh-1');
    api.invite.mockRejectedValue(apiError(409, 'invite_self'));
    renderWithProviders(<HouseholdMembersCard store={store} />);

    fireEvent.change(screen.getByLabelText("Partner's email"), {
      target: { value: 'ann@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invite partner' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot invite yourself.');
  });

  it('shows a member both members and no invite form', async () => {
    api.members.mockResolvedValue([OWNER, PARTNER]);
    await store.load('user-bob', 'hh-1');
    renderWithProviders(<HouseholdMembersCard store={store} />);

    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.queryByLabelText("Partner's email")).toBeNull();
    expect(api.invites).not.toHaveBeenCalled();
  });

  it('shows only the sum for total_only categories, counts otherwise, details for full_detail', async () => {
    await store.load('user-ann', 'hh-1');
    renderWithProviders(<HouseholdAggregatesCard store={store} />);

    const rows = screen.getAllByRole('listitem');
    const [groceries, fuel, kids] = rows;
    if (groceries === undefined || fuel === undefined || kids === undefined) {
      throw new Error('expected three category rows');
    }
    // total_only: the shared glass CategoryRow, which shows the sum and nothing else.
    expect(within(groceries).getByRole('group')).toHaveAccessibleName(
      /^Groceries: PLN\s1,500\.00 spent, totals only$/,
    );
    expect(within(groceries).getByText('Totals only')).toBeInTheDocument();
    expect(within(groceries).queryByText(/transaction/)).toBeNull();
    expect(within(groceries).queryByRole('link')).toBeNull();

    expect(within(fuel).getByText('Total + count')).toBeInTheDocument();
    expect(within(fuel).getByText('3 transactions')).toBeInTheDocument();
    expect(within(fuel).getByRole('group')).toHaveAccessibleName(
      /^Fuel: PLN\s420\.00, Total \+ count$/,
    );
    expect(within(fuel).queryByRole('link')).toBeNull();

    expect(within(kids).getByText('Full detail')).toBeInTheDocument();
    expect(within(kids).getByText('1 transaction')).toBeInTheDocument();
    expect(within(kids).getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      '/household?planId=plan-1&categoryId=cat-Kids',
    );
  });

  it('explains missing exchange rates for the shared totals', async () => {
    api.dashboard.mockRejectedValue(apiError(503, 'fx_rate_unavailable'));
    await store.load('user-ann', 'hh-1');
    renderWithProviders(<HouseholdAggregatesCard store={store} />);

    expect(
      screen.getByText('Exchange rates are not available right now. Please try again later.'),
    ).toBeInTheDocument();
    api.dashboard.mockResolvedValue({ planId: 'plan-1', categories: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText("No transactions in this plan's period yet.")).toBeInTheDocument();
    });
  });

  it('points to the plans screen without a household plan', async () => {
    store = new HouseholdStore(api, { list: vi.fn().mockResolvedValue([]) });
    await store.load('user-ann', 'hh-1');
    renderWithProviders(<HouseholdAggregatesCard store={store} />);

    expect(screen.getByRole('link', { name: 'Go to plans' })).toHaveAttribute('href', '/plans');
  });
});
