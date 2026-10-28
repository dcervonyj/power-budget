// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { uuidv7 } from 'uuidv7';
import { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  UserRegistrationRepository,
  PasswordHashing,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { EmailAlreadyRegisteredError } from '../../../domain/auth/errors.js';
import type { LocaleCode } from '../../../domain/auth/entities.js';

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly locale?: LocaleCode;
}

export interface RegisterUserOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly registrationRepo: UserRegistrationRepository,
    private readonly passwordHashing: PasswordHashing,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    // Fast path only: a concurrent registration of the same email is caught by the unique
    // index inside `register` (CLN-033).
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing !== null) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHashing.hash(input.password);
    const userId = UserId.of(uuidv7());
    const householdId = HouseholdId.of(uuidv7());
    const displayName = input.email.split('@')[0] ?? input.email;

    // User, household and owner membership in one transaction: a failure leaves no rows.
    await this.registrationRepo.register({
      user: {
        id: userId,
        email: input.email,
        displayName,
        defaultLocale: input.locale ?? 'en',
        passwordHash,
      },
      household: { id: householdId, name: `${displayName}'s household`, baseCurrency: 'PLN' },
    });

    const accessToken = this.jwtIssuer.issue({ userId, householdId });
    const refreshToken = await this.refreshTokenStore.issue(userId, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId };
  }
}
