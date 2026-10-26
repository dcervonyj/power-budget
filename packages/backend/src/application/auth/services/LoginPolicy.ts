import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  FailedAttemptCounter,
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { TotpLockedError, TotpRequiredError } from '../../../domain/auth/errors.js';
import type { TotpAuthenticator } from './TotpAuthenticator.js';

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Second-factor codes a user may try per window, whatever the IP or first factor. */
export const MAX_SECOND_FACTOR_ATTEMPTS = 5;
export const SECOND_FACTOR_WINDOW_SECONDS = 15 * 60;

/**
 * The one login policy for every first factor (password, magic link; audit H6):
 * once TOTP is enabled, a login needs a valid TOTP code as well.
 *
 * Codes are limited per user (CLN-031, audit BE-BUGS-02): the attempt is
 * counted before the code is checked, so even concurrent requests check at
 * most MAX_SECOND_FACTOR_ATTEMPTS codes per window; then TotpLockedError
 * (429) until the window ends. A valid code resets the count.
 */
export class LoginPolicy {
  constructor(
    private readonly totp: TotpAuthenticator,
    private readonly householdRepo: HouseholdRepository,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly attemptCounter: FailedAttemptCounter,
  ) {}

  /**
   * Throws TotpRequiredError (no code), TotpLockedError (too many attempts) or
   * TotpInvalidError (wrong or replayed code).
   */
  async assertSecondFactor(userId: UserId, totpCode: string | undefined): Promise<void> {
    if (!(await this.totp.isEnabled(userId))) {
      return;
    }
    if (totpCode === undefined || totpCode.length === 0) {
      throw new TotpRequiredError();
    }

    const key = attemptKey(userId);
    const current = await this.attemptCounter.increment(key, SECOND_FACTOR_WINDOW_SECONDS);
    if (current.attempts > MAX_SECOND_FACTOR_ATTEMPTS) {
      throw new TotpLockedError(current.secondsLeft);
    }

    await this.totp.verify(userId, totpCode);
    await this.attemptCounter.reset(key);
  }

  async issueSession(userId: UserId): Promise<SessionTokens> {
    const household = await this.householdRepo.findByUserId(userId);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId, householdId });
    const refreshToken = await this.refreshTokenStore.issue(userId, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId };
  }
}

function attemptKey(userId: UserId): string {
  return `totp-failures:${userId}`;
}
