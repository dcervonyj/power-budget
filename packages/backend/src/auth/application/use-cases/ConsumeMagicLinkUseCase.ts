import { createHash } from 'node:crypto';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  MagicLinkTokenRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { MagicLinkExpiredError } from '../../domain/errors.js';
import type { ConsumeMagicLinkInput, ConsumeMagicLinkOutput } from '../models/index.js';
export type { ConsumeMagicLinkInput, ConsumeMagicLinkOutput };

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class ConsumeMagicLinkUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly magicLinkTokenRepo: MagicLinkTokenRepository,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: ConsumeMagicLinkInput): Promise<ConsumeMagicLinkOutput> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const consumed = await this.magicLinkTokenRepo.consume(tokenHash);

    if (consumed === null) {
      throw new MagicLinkExpiredError();
    }

    const household = await this.householdRepo.findByUserId(consumed.userId);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId: consumed.userId, householdId });
    const refreshToken = await this.refreshTokenStore.issue(
      consumed.userId,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return { accessToken, refreshToken, userId: consumed.userId };
  }
}
