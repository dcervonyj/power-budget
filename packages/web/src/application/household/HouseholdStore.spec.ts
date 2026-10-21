import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  HouseholdDashboardResponseDto,
  HouseholdInviteResponseDto,
  HouseholdMemberResponseDto,
  PlanDto,
} from '@power-budget/shared-app/contract';
import { HouseholdStore } from './HouseholdStore.js';
import { PLAN, apiError } from '../../test/dashboardFixtures.js';

vi.mock('../../AppProviders.js', () => ({ householdsApi: {}, plansApi: {} }));

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
const INVITE: HouseholdInviteResponseDto = {
  id: 'invite-1',
  email: 'bob@example.com',
  status: 'pending',
  expiresAt: '2026-10-28T12:00:00.000Z',
  createdAt: '2026-10-21T12:00:00.000Z',
};
const PERSONAL: PlanDto = { ...PLAN, id: 'plan-personal', type: 'personal' };
const AGGREGATES: HouseholdDashboardResponseDto = {
  planId: 'plan-1',
  categories: [
    {
      categoryId: 'cat-groceries',
      categoryName: 'Groceries',
      privacyLevel: 'total_only',
      totalAmountMinor: '150000',
      currency: 'PLN',
      transactionCount: 2,
    },
  ],
};

function makeApi() {
  return {
    members: vi.fn().mockResolvedValue([OWNER]),
    invites: vi.fn().mockResolvedValue([INVITE]),
    invite: vi.fn().mockResolvedValue(INVITE),
    resendInvite: vi.fn().mockResolvedValue(INVITE),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    dashboard: vi.fn().mockResolvedValue(AGGREGATES),
  };
}

describe('HouseholdStore', () => {
  let api: ReturnType<typeof makeApi>;
  let list: ReturnType<typeof vi.fn>;
  let store: HouseholdStore;

  beforeEach(() => {
    api = makeApi();
    list = vi.fn().mockResolvedValue([PERSONAL, PLAN]);
    store = new HouseholdStore(api, { list });
  });

  it('loads the members, the owner’s open invite and the household plan totals', async () => {
    await store.load('user-ann', 'hh-1');

    expect(store.loaded).toBe(true);
    expect(store.isOwner).toBe(true);
    expect(store.canInvite).toBe(true);
    expect(store.invites).toEqual([INVITE]);
    expect(store.householdPlans.map((p) => p.id)).toEqual(['plan-1']);
    expect(store.selectedPlanId).toBe('plan-1');
    expect(api.dashboard).toHaveBeenCalledWith('hh-1', 'plan-1');
    expect(store.categories).toEqual(AGGREGATES.categories);
  });

  it('does not ask a member for invites and offers no invite form', async () => {
    api.members.mockResolvedValue([OWNER, PARTNER]);

    await store.load('user-bob', 'hh-1');

    expect(store.isOwner).toBe(false);
    expect(store.canInvite).toBe(false);
    expect(store.partner).toEqual(OWNER);
    expect(api.invites).not.toHaveBeenCalled();
  });

  it('a full household offers no invite form even to the owner', async () => {
    api.members.mockResolvedValue([OWNER, PARTNER]);

    await store.load('user-ann', 'hh-1');

    expect(store.isOwner).toBe(true);
    expect(store.canInvite).toBe(false);
  });

  it('sends an invite and re-reads the open invite', async () => {
    await store.load('user-ann', 'hh-1');
    api.invites.mockClear();

    await store.sendInvite('  bob@example.com ');

    expect(api.invite).toHaveBeenCalledWith('bob@example.com');
    expect(api.invites).toHaveBeenCalledTimes(1);
    expect(store.inviteNotice).toBe('sent');
    expect(store.inviteError).toBeNull();
    expect(store.inviteBusy).toBe(false);
  });

  it('refuses an obviously wrong address without calling the API', async () => {
    await store.sendInvite('bob');

    expect(store.inviteError).toBe('invalid_email');
    expect(api.invite).not.toHaveBeenCalled();
  });

  it.each([
    [apiError(409, 'household_full'), 'household_full'],
    [apiError(409, 'invite_self'), 'invite_self'],
    [apiError(429, 'too_many_requests'), 'too_many_requests'],
    [apiError(400), 'invalid_email'],
    [apiError(500), 'failed'],
  ])('maps an invite failure (%#) to %s', async (error, expected) => {
    api.invite.mockRejectedValue(error);

    await store.sendInvite('bob@example.com');

    expect(store.inviteError).toBe(expected);
    expect(store.inviteNotice).toBeNull();
    expect(store.inviteBusy).toBe(false);
  });

  it('resends and revokes the open invite', async () => {
    await store.resendInvite('invite-1');
    expect(api.resendInvite).toHaveBeenCalledWith('invite-1');
    expect(store.inviteNotice).toBe('resent');

    api.invites.mockResolvedValue([]);
    await store.revokeInvite('invite-1');
    expect(api.revokeInvite).toHaveBeenCalledWith('invite-1');
    expect(store.inviteNotice).toBe('revoked');
    expect(store.invites).toEqual([]);
  });

  it('flags missing exchange rates for the totals', async () => {
    api.dashboard.mockRejectedValue(apiError(503, 'fx_rate_unavailable'));

    await store.load('user-ann', 'hh-1');

    expect(store.loaded).toBe(true);
    expect(store.aggregatesError).toBe('fx_unavailable');
    expect(store.categories).toEqual([]);
  });

  it('has no totals without a household plan', async () => {
    list.mockResolvedValue([PERSONAL]);

    await store.load('user-ann', 'hh-1');

    expect(store.selectedPlanId).toBeNull();
    expect(api.dashboard).not.toHaveBeenCalled();
  });

  it('forgets the previous household when another user loads', async () => {
    await store.load('user-ann', 'hh-1');
    api.members.mockReturnValue(new Promise(() => undefined));

    void store.load('user-bob', 'hh-2');

    expect(store.loaded).toBe(false);
    expect(store.members).toEqual([]);
    expect(store.invites).toEqual([]);
  });

  it('flags a failed load', async () => {
    api.members.mockRejectedValue(apiError(500));

    await store.load('user-ann', 'hh-1');

    expect(store.loadFailed).toBe(true);
    expect(store.loading).toBe(false);
  });
});
