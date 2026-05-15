import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  OAuthProvider,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';

export interface LoginWithGoogleInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly state: string;
}

export interface LoginWithGoogleOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class LoginWithGoogleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly oauthProvider: OAuthProvider,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<LoginWithGoogleOutput> {
    const { email } = await this.oauthProvider.exchange(input.code, input.redirectUri);

    const existingUser = await this.userRepo.findByEmail(email);
    const user = existingUser !== null ? existingUser : await this.createUserWithHousehold(email);

    const household = await this.householdRepo.findByUserId(user.id);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId: user.id, householdId });
    const refreshToken = await this.refreshTokenStore.issue(user.id, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId: user.id };
  }

  private async createUserWithHousehold(
    email: string,
  ): Promise<import('../../../domain/auth/entities.js').User> {
    const userId = uuidv7() as UserId;
    const user = await this.userRepo.create({
      id: userId,
      email,
      displayName: email.split('@')[0] ?? email,
      defaultLocale: 'en',
      passwordHash: null,
    });

    const householdId = uuidv7() as HouseholdId;
    const household = await this.householdRepo.create({
      id: householdId,
      name: `${user.displayName}'s household`,
      baseCurrency: 'PLN',
    });

    await this.householdRepo.addMember(household.id, user.id, 'owner');

    return user;
  }
}
