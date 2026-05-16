import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { InvalidCredentialsError } from '../../domain/errors.js';

export interface RefreshTokenInput {
  readonly refreshToken: string;
}

export interface RefreshTokenOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const rotated = await this.refreshTokenStore.rotate(input.refreshToken);
    if (rotated === null) {
      throw new InvalidCredentialsError();
    }

    const household = await this.householdRepo.findByUserId(rotated.userId);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId: rotated.userId, householdId });

    return { accessToken, refreshToken: rotated.newToken, userId: rotated.userId };
  }
}
