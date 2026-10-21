import { beforeEach, describe, expect, it } from 'vitest';
import type {
  HouseholdDashboardResponseDto,
  HouseholdInviteResponseDto,
  HouseholdMemberResponseDto,
} from '../../../contract/dto.js';
import { RecordingHttpClient } from '../../../test/RecordingHttpClient.js';
import { HouseholdsApi } from '../HouseholdsApi.js';

const invite: HouseholdInviteResponseDto = {
  id: 'invite-1',
  email: 'bob@example.com',
  status: 'pending',
  expiresAt: '2026-10-28T12:00:00.000Z',
  createdAt: '2026-10-21T12:00:00.000Z',
};

const member: HouseholdMemberResponseDto = {
  userId: 'user-1',
  email: 'ann@example.com',
  displayName: 'Ann',
  role: 'owner',
  joinedAt: '2026-10-01T10:00:00.000Z',
};

const dashboard: HouseholdDashboardResponseDto = {
  planId: 'plan-1',
  categories: [
    {
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      privacyLevel: 'total_only',
      totalAmountMinor: '150000',
      currency: 'PLN',
      transactionCount: 3,
    },
  ],
};

describe('HouseholdsApi', () => {
  let http: RecordingHttpClient;
  let api: HouseholdsApi;

  beforeEach(() => {
    http = new RecordingHttpClient();
    api = new HouseholdsApi(http);
  });

  it('lists the members and the open invites', async () => {
    http.respondWith([member], [invite]);

    expect(await api.members()).toEqual([member]);
    expect(await api.invites()).toEqual([invite]);
    expect(http.calls).toEqual([
      { method: 'GET', url: '/households/members' },
      { method: 'GET', url: '/households/invites' },
    ]);
  });

  it('invites, resends and revokes', async () => {
    http.respondWith(invite, invite, undefined);

    expect(await api.invite('bob@example.com')).toEqual(invite);
    expect(await api.resendInvite('invite-1')).toEqual(invite);
    await api.revokeInvite('invite-1');

    expect(http.calls).toEqual([
      { method: 'POST', url: '/households/invites', body: { email: 'bob@example.com' } },
      { method: 'POST', url: '/households/invites/invite-1/resend', body: {} },
      { method: 'DELETE', url: '/households/invites/invite-1' },
    ]);
  });

  it('accepts with the token in the body', async () => {
    http.respondWith({ householdId: 'hh-1', accessToken: 'new-access' });

    expect(await api.acceptInvite('raw-token')).toEqual({
      householdId: 'hh-1',
      accessToken: 'new-access',
    });
    expect(http.calls).toEqual([
      { method: 'POST', url: '/households/invites/accept', body: { token: 'raw-token' } },
    ]);
  });

  it('reads the household dashboard of a plan', async () => {
    http.respondWith(dashboard);

    expect(await api.dashboard('hh-1', 'plan 1')).toEqual(dashboard);
    expect(http.calls).toEqual([
      { method: 'GET', url: '/households/hh-1/dashboard?planId=plan%201' },
    ]);
  });
});
