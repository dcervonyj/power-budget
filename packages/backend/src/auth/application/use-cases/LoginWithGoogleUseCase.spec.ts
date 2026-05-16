import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  OAuthProvider,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { LoginWithGoogleUseCase } from './LoginWithGoogleUseCase.js';
import type { User, Household } from '../../domain/entities.js';

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
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: LoginWithGoogleUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    oauthProvider = mock<OAuthProvider>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new LoginWithGoogleUseCase(
      userRepo,
      householdRepo,
      oauthProvider,
      jwtIssuer,
      refreshTokenStore,
    );
  });

  it('logs in an existing user via Google OAuth', async () => {
    oauthProvider.exchange.mockResolvedValue({
      email: 'alice@example.com',
      subject: 'google-sub-123',
      emailVerified: true,
    });
    userRepo.findByEmail.mockResolvedValue(makeUser());
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://app.example.com/callback',
      state: 'csrf-state',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.userId).toBe(TEST_USER_ID);
    expect(userRepo.create).not.toHaveBeenCalled();
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
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://app.example.com/callback',
      state: 'csrf-state',
    });

    expect(result.accessToken).toBe('access-token');
    expect(userRepo.create).toHaveBeenCalledOnce();
    expect(householdRepo.create).toHaveBeenCalledOnce();
  });
});
