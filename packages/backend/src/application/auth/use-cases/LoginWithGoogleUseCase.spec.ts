import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  OAuthProvider,
} from '../../../domain/auth/ports.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';
import { LoginWithGoogleUseCase } from './LoginWithGoogleUseCase.js';
import { InvalidCredentialsError, TotpRequiredError } from '../../../domain/auth/errors.js';
import type { User, Household } from '../../../domain/auth/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makeUser(): User {
  return {
    id: TEST_USER_ID,
    email: 'alice@example.com',
    displayName: 'alice',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe('LoginWithGoogleUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let oauthProvider: ReturnType<typeof mock<OAuthProvider>>;
  let loginPolicy: ReturnType<typeof mock<LoginPolicy>>;
  let useCase: LoginWithGoogleUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    oauthProvider = mock<OAuthProvider>();
    loginPolicy = mock<LoginPolicy>();
    loginPolicy.issueSession.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userId: TEST_USER_ID,
    });
    useCase = new LoginWithGoogleUseCase(userRepo, householdRepo, oauthProvider, loginPolicy);
  });

  it('logs in an existing user via Google OAuth', async () => {
    oauthProvider.exchange.mockResolvedValue({
      email: 'alice@example.com',
      subject: 'google-sub-123',
      emailVerified: true,
    });
    userRepo.findByEmail.mockResolvedValue(makeUser());

    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://app.example.com/callback',
      state: 'csrf-state',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.userId).toBe(TEST_USER_ID);
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(loginPolicy.assertSecondFactor).toHaveBeenCalledWith(TEST_USER_ID, undefined);
  });

  it('applies the shared login policy: no session when the TOTP check fails', async () => {
    oauthProvider.exchange.mockResolvedValue({
      email: 'alice@example.com',
      subject: 'google-sub-123',
      emailVerified: true,
    });
    userRepo.findByEmail.mockResolvedValue(makeUser());
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpRequiredError());

    await expect(
      useCase.execute({ code: 'c', redirectUri: 'https://app.example.com/cb', state: 's' }),
    ).rejects.toThrow(TotpRequiredError);
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });

  it('creates a new user when Google account is not registered', async () => {
    oauthProvider.exchange.mockResolvedValue({
      email: 'new@example.com',
      subject: 'google-sub-456',
      emailVerified: true,
    });
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.create.mockResolvedValue(makeUser());
    householdRepo.create.mockResolvedValue(makeHousehold());
    householdRepo.addMember.mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
      userId: TEST_USER_ID,
      role: 'owner',
      joinedAt: new Date(),
    });

    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://app.example.com/callback',
      state: 'csrf-state',
    });

    expect(result.accessToken).toBe('access-token');
    expect(userRepo.create).toHaveBeenCalledOnce();
    expect(householdRepo.create).toHaveBeenCalledOnce();
  });

  it('rejects the stub identity (empty email) without creating a user', async () => {
    oauthProvider.exchange.mockResolvedValue({ email: '', subject: '', emailVerified: false });

    await expect(
      useCase.execute({ code: 'any', redirectUri: 'https://app.example.com/cb', state: 's' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });

  it('rejects an identity whose email is not verified by Google', async () => {
    oauthProvider.exchange.mockResolvedValue({
      email: 'mallory@example.com',
      subject: 'google-sub-789',
      emailVerified: false,
    });

    await expect(
      useCase.execute({ code: 'any', redirectUri: 'https://app.example.com/cb', state: 's' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });
});
