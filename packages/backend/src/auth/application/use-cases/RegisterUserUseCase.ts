import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  PasswordHashing,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { HouseholdInvariants } from '../../domain/invariants.js';
import { EmailAlreadyRegisteredError } from '../../domain/errors.js';
import type { LocaleCode } from '../../domain/entities.js';
import type { RegisterUserInput, RegisterUserOutput } from '../models/index.js';
export type { RegisterUserInput, RegisterUserOutput };

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly passwordHashing: PasswordHashing,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing !== null) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHashing.hash(input.password);
    const userId = uuidv7() as UserId;

    const user = await this.userRepo.create({
      id: userId,
      email: input.email,
      displayName: input.email.split('@')[0] ?? input.email,
      defaultLocale: input.locale ?? 'en',
      passwordHash,
    });

    const existingHousehold = await this.householdRepo.findByUserId(user.id);
    // A brand-new user should have no household; invariant guards multi-household join.
    HouseholdInvariants.assertSingleHousehold(
      existingHousehold !== null
        ? [
            {
              householdId: existingHousehold.id,
              userId: user.id,
              role: 'owner' as const,
              joinedAt: new Date(),
            },
          ]
        : [],
    );

    const householdId = uuidv7() as HouseholdId;
    const household = await this.householdRepo.create({
      id: householdId,
      name: `${user.displayName}'s household`,
      baseCurrency: 'PLN',
    });

    await this.householdRepo.addMember(household.id, user.id, 'owner');

    const accessToken = this.jwtIssuer.issue({ userId: user.id, householdId: household.id });
    const refreshToken = await this.refreshTokenStore.issue(user.id, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId: user.id };
  }
}
