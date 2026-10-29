import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, UserId } from '@power-budget/core';
import type {
  FailedAttemptCounter,
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import {
  TotpInvalidError,
  TotpLockedError,
  TotpRequiredError,
} from '../../../domain/auth/errors.js';
import { LoginPolicy } from './LoginPolicy.js';
import type { TotpAuthenticator } from './TotpAuthenticator.js';

const USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000002');

describe('LoginPolicy', () => {
  let totp: ReturnType<typeof createMock<TotpAuthenticator>>;
  let householdRepo: ReturnType<typeof createMock<HouseholdRepository>>;
  let jwtIssuer: ReturnType<typeof createMock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof createMock<RefreshTokenStore>>;
  let attemptCounter: ReturnType<typeof createMock<FailedAttemptCounter>>;
  let policy: LoginPolicy;

  beforeEach(() => {
    totp = createMock<TotpAuthenticator>();
    householdRepo = createMock<HouseholdRepository>();
    jwtIssuer = createMock<JwtAccessTokenIssuer>();
    refreshTokenStore = createMock<RefreshTokenStore>();
    attemptCounter = createMock<FailedAttemptCounter>();
    attemptCounter.increment.mockResolvedValue({ attempts: 1, secondsLeft: 900 });
    policy = new LoginPolicy(totp, householdRepo, jwtIssuer, refreshTokenStore, attemptCounter);
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
      expect(attemptCounter.increment).not.toHaveBeenCalled();
    });

    it('verifies the code once TOTP is enabled', async () => {
      totp.isEnabled.mockResolvedValue(true);

      await policy.assertSecondFactor(USER_ID, '123456');

      expect(totp.verify).toHaveBeenCalledWith(USER_ID, '123456');
    });

    it('counts the attempt per user before checking, and resets the count on success', async () => {
      totp.isEnabled.mockResolvedValue(true);

      await policy.assertSecondFactor(USER_ID, '123456');

      expect(attemptCounter.increment).toHaveBeenCalledWith(`totp-failures:${USER_ID}`, 15 * 60);
      expect(attemptCounter.reset).toHaveBeenCalledWith(`totp-failures:${USER_ID}`);
    });

    it('propagates a rejected code and keeps it counted', async () => {
      totp.isEnabled.mockResolvedValue(true);
      totp.verify.mockRejectedValue(new TotpInvalidError());

      await expect(policy.assertSecondFactor(USER_ID, '000000')).rejects.toThrow(TotpInvalidError);
      expect(attemptCounter.increment).toHaveBeenCalledWith(`totp-failures:${USER_ID}`, 15 * 60);
      expect(attemptCounter.reset).not.toHaveBeenCalled();
    });

    it('still checks the fifth attempt in a window', async () => {
      totp.isEnabled.mockResolvedValue(true);
      attemptCounter.increment.mockResolvedValue({ attempts: 5, secondsLeft: 600 });

      await policy.assertSecondFactor(USER_ID, '123456');

      expect(totp.verify).toHaveBeenCalledWith(USER_ID, '123456');
    });

    it('locks the user out after five attempts, without checking the code', async () => {
      totp.isEnabled.mockResolvedValue(true);
      attemptCounter.increment.mockResolvedValue({ attempts: 6, secondsLeft: 600 });

      const result = policy.assertSecondFactor(USER_ID, '123456');

      await expect(result).rejects.toThrow(TotpLockedError);
      await expect(result).rejects.toMatchObject({ retryAfterSeconds: 600 });
      expect(totp.verify).not.toHaveBeenCalled();
      expect(attemptCounter.reset).not.toHaveBeenCalled();
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
