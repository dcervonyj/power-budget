import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcceptInvite } from './AcceptInvite.js';
import { apiError } from '../../test/dashboardFixtures.js';

describe('AcceptInvite', () => {
  let acceptInvite: Mock<(token: string) => Promise<{ householdId: string; accessToken: string }>>;
  let setTokens: Mock<(accessToken: string, refreshToken: string) => Promise<void>>;
  let useCase: AcceptInvite;

  beforeEach(() => {
    acceptInvite = vi.fn().mockResolvedValue({ householdId: 'hh-2', accessToken: 'new-access' });
    setTokens = vi.fn().mockResolvedValue(undefined);
    useCase = new AcceptInvite({ acceptInvite }, { getRefreshToken: () => 'refresh-1', setTokens });
  });

  it('joins and keeps the refresh token with the new access token', async () => {
    expect(await useCase.execute('raw-token')).toEqual({ kind: 'joined', householdId: 'hh-2' });
    expect(acceptInvite).toHaveBeenCalledWith('raw-token');
    expect(setTokens).toHaveBeenCalledWith('new-access', 'refresh-1');
  });

  it('does not call the API without a token', async () => {
    expect(await useCase.execute(' ')).toEqual({ kind: 'failed', error: 'missing_token' });
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it.each([
    [apiError(403, 'email_mismatch'), 'email_mismatch'],
    [apiError(404, 'invite_not_found'), 'invite_not_found'],
    [apiError(410, 'invite_expired'), 'invite_expired'],
    [apiError(409, 'invite_already_used'), 'invite_already_used'],
    [apiError(409, 'already_in_household'), 'already_in_household'],
    [apiError(409, 'household_full'), 'household_full'],
    [apiError(409, 'household_not_empty'), 'household_not_empty'],
    [apiError(500), 'failed'],
  ])('maps a failure (%#) to %s and keeps the tokens', async (error, expected) => {
    acceptInvite.mockRejectedValue(error);

    expect(await useCase.execute('raw-token')).toEqual({ kind: 'failed', error: expected });
    expect(setTokens).not.toHaveBeenCalled();
  });
});
