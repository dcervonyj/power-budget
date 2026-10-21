import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { TotpInvalidError, TotpRequiredError } from '../../../domain/auth/errors.js';
import { LoginPolicy } from './LoginPolicy.js';
import type { TotpAuthenticator } from './TotpAuthenticator.js';

const USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

describe('LoginPolicy', () => {
  let totp: ReturnType<typeof mock<TotpAuthenticator>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let policy: LoginPolicy;

  beforeEach(() => {
    totp = mock<TotpAuthenticator>();
    householdRepo = mock<HouseholdRepository>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    policy = new LoginPolicy(totp, householdRepo, jwtIssuer, refreshTokenStore);
  });

  describe('assertSecondFactor', () => {
    it('passes without a code while TOTP is not enabled', async () => {
      totp.isEnabled.mockResolvedValue(false);

      await expect(policy.assertSecondFactor(USER_ID, undefined)).resolves.toBeUndefined();
      expect(totp.verify).not.toHaveBeenCalled();
    });

    it('demands a code once TOTP is enabled', async () => {
      totp.isEnabled.mockResolvedValue(true);

      await expect(policy.assertSecondFactor(USER_ID, undefined)).rejects.toThrow(
        TotpRequiredError,
      );
      await expect(policy.assertSecondFactor(USER_ID, '')).rejects.toThrow(TotpRequiredError);
      expect(totp.verify).not.toHaveBeenCalled();
    });

    it('verifies the code once TOTP is enabled', async () => {
      totp.isEnabled.mockResolvedValue(true);

      await policy.assertSecondFactor(USER_ID, '123456');

      expect(totp.verify).toHaveBeenCalledWith(USER_ID, '123456');
    });

    it('propagates a rejected code', async () => {
      totp.isEnabled.mockResolvedValue(true);
      totp.verify.mockRejectedValue(new TotpInvalidError());

      await expect(policy.assertSecondFactor(USER_ID, '000000')).rejects.toThrow(TotpInvalidError);
    });
  });

  describe('issueSession', () => {
    it('issues an access token with the household and a 30-day refresh token', async () => {
      householdRepo.findByUserId.mockResolvedValue({
        id: HOUSEHOLD_ID,
        name: 'h',
        baseCurrency: 'PLN',
        createdAt: new Date(),
      });
      jwtIssuer.issue.mockReturnValue('access-token');
      refreshTokenStore.issue.mockResolvedValue('refresh-token');

      const result = await policy.issueSession(USER_ID);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: USER_ID,
      });
      expect(jwtIssuer.issue).toHaveBeenCalledWith({ userId: USER_ID, householdId: HOUSEHOLD_ID });
      expect(refreshTokenStore.issue).toHaveBeenCalledWith(USER_ID, 60 * 60 * 24 * 30);
    });

    it('issues a token without household for a user without one', async () => {
      householdRepo.findByUserId.mockResolvedValue(null);
      jwtIssuer.issue.mockReturnValue('access-token');
      refreshTokenStore.issue.mockResolvedValue('refresh-token');

      await policy.issueSession(USER_ID);

      expect(jwtIssuer.issue).toHaveBeenCalledWith({ userId: USER_ID, householdId: null });
    });
  });
});
