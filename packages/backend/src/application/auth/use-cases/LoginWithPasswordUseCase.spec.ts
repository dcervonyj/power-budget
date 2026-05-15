import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
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
} from '../../../domain/auth/ports.js';
import { LoginWithPasswordUseCase } from './LoginWithPasswordUseCase.js';
import {
  InvalidCredentialsError,
  TotpRequiredError,
  TotpInvalidError,
} from '../../../domain/auth/errors.js';
import type { User, Household, TotpSecret } from '../../../domain/auth/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: TEST_USER_ID,
    email: 'alice@example.com',
    displayName: 'alice',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: 'hashed',
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeHousehold(): Household {
  return {
    id: TEST_HOUSEHOLD_ID,
    name: "alice's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
  };
}

function makeTotpSecret(): TotpSecret {
  return {
    userId: TEST_USER_ID,
    encryptedSecret: 'base32secret',
    enrolledAt: new Date(),
    verifiedAt: new Date(),
  };
}

describe('LoginWithPasswordUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let passwordHashing: ReturnType<typeof mock<PasswordHashing>>;
  let totpVerifier: ReturnType<typeof mock<TotpVerifier>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let bankConnectionChecker: ReturnType<typeof mock<BankConnectionChecker>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: LoginWithPasswordUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    passwordHashing = mock<PasswordHashing>();
    totpVerifier = mock<TotpVerifier>();
    totpSecretRepo = mock<TotpSecretRepository>();
    bankConnectionChecker = mock<BankConnectionChecker>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new LoginWithPasswordUseCase(
      userRepo,
      householdRepo,
      passwordHashing,
      totpVerifier,
      totpSecretRepo,
      bankConnectionChecker,
      jwtIssuer,
      refreshTokenStore,
    );
  });

  it('logs in successfully without bank connection (no TOTP required)', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);
    bankConnectionChecker.hasActiveConnection.mockResolvedValue(false);
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({ email: 'alice@example.com', password: 'correct' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(totpVerifier.verify).not.toHaveBeenCalled();
  });

  it('throws TotpRequiredError when user has bank connection but no TOTP code provided', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);
    bankConnectionChecker.hasActiveConnection.mockResolvedValue(true);
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'correct' }),
    ).rejects.toThrow(TotpRequiredError);
  });

  it('throws TotpInvalidError when TOTP code is wrong', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);
    bankConnectionChecker.hasActiveConnection.mockResolvedValue(true);
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());
    totpVerifier.verify.mockReturnValue(false);

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'correct', totp: 'wrong' }),
    ).rejects.toThrow(TotpInvalidError);
  });

  it('throws InvalidCredentialsError for wrong password', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('logs in with valid TOTP when bank connection exists', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);
    bankConnectionChecker.hasActiveConnection.mockResolvedValue(true);
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());
    totpVerifier.verify.mockReturnValue(true);
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({
      email: 'alice@example.com',
      password: 'correct',
      totp: '123456',
    });

    expect(result.accessToken).toBe('access-token');
  });
});
