import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  OAuthProvider,
} from '../../../domain/auth/ports.js';
import { InvalidCredentialsError } from '../../../domain/auth/errors.js';
import type { User } from '../../../domain/auth/entities.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';

export interface LoginWithGoogleInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly totp?: string;
}

export interface LoginWithGoogleOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

// Not wired to any route since CLN-001 (audit C2). If it is re-added it goes
// through the same LoginPolicy as password and magic-link login (audit H6).
export class LoginWithGoogleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly oauthProvider: OAuthProvider,
    private readonly loginPolicy: LoginPolicy,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<LoginWithGoogleOutput> {
    const { email, emailVerified } = await this.oauthProvider.exchange(
      input.code,
      input.redirectUri,
    );
    // Never find-or-create a user from an unverified or empty identity (audit C2).
    if (email.trim().length === 0 || !emailVerified) {
      throw new InvalidCredentialsError();
    }

    const existingUser = await this.userRepo.findByEmail(email);
    const user = existingUser !== null ? existingUser : await this.createUserWithHousehold(email);

    await this.loginPolicy.assertSecondFactor(user.id, input.totp);

    return this.loginPolicy.issueSession(user.id);
  }

  private async createUserWithHousehold(email: string): Promise<User> {
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
