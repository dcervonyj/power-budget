import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { TotpRequiredError } from '../../../domain/auth/errors.js';
import type { TotpAuthenticator } from './TotpAuthenticator.js';

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The one login policy for every first factor (password, magic link; audit H6):
 * once TOTP is enabled, a login needs a valid TOTP code as well.
 */
export class LoginPolicy {
  constructor(
    private readonly totp: TotpAuthenticator,
    private readonly householdRepo: HouseholdRepository,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  /** Throws TotpRequiredError (no code) or TotpInvalidError (wrong or replayed code). */
  async assertSecondFactor(userId: UserId, totpCode: string | undefined): Promise<void> {
    if (!(await this.totp.isEnabled(userId))) {
      return;
    }
    if (totpCode === undefined || totpCode.length === 0) {
      throw new TotpRequiredError();
    }

    await this.totp.verify(userId, totpCode);
  }

  async issueSession(userId: UserId): Promise<SessionTokens> {
    const household = await this.householdRepo.findByUserId(userId);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId, householdId });
    const refreshToken = await this.refreshTokenStore.issue(userId, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId };
  }
}
