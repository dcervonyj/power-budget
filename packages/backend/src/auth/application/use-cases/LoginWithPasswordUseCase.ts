import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  PasswordHashing,
  TotpVerifier,
  TotpSecretRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
  BankConnectionChecker,
} from '../../domain/ports.js';
import {
  InvalidCredentialsError,
  TotpRequiredError,
  TotpInvalidError,
} from '../../domain/errors.js';

export interface LoginWithPasswordInput {
  readonly email: string;
  readonly password: string;
  readonly totp?: string;
}

export interface LoginWithPasswordOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export class LoginWithPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly passwordHashing: PasswordHashing,
    private readonly totpVerifier: TotpVerifier,
    private readonly totpSecretRepo: TotpSecretRepository,
    private readonly bankConnectionChecker: BankConnectionChecker,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
    private readonly refreshTokenStore: RefreshTokenStore,
  ) {}

  async execute(input: LoginWithPasswordInput): Promise<LoginWithPasswordOutput> {
    const user = await this.userRepo.findByEmail(input.email);
    if (user === null || user.passwordHash === null) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHashing.verify(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new InvalidCredentialsError();
    }

    const hasBankConnection = await this.bankConnectionChecker.hasActiveConnection(user.id);
    if (hasBankConnection) {
      await this.assertTotpStepUp(user.id, input.totp);
    }

    const household = await this.householdRepo.findByUserId(user.id);
    const householdId: HouseholdId | null = household !== null ? household.id : null;

    const accessToken = this.jwtIssuer.issue({ userId: user.id, householdId });
    const refreshToken = await this.refreshTokenStore.issue(user.id, REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken, userId: user.id };
  }

  private async assertTotpStepUp(userId: UserId, code: string | undefined): Promise<void> {
    if (code === undefined) {
      throw new TotpRequiredError();
    }

    const totpSecret = await this.totpSecretRepo.findByUser(userId);
    if (totpSecret === null) {
      throw new TotpRequiredError();
    }

    const valid = this.totpVerifier.verify(totpSecret.encryptedSecret, code);
    if (!valid) {
      throw new TotpInvalidError();
    }
  }
}
