import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  PasswordHashing,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { RegisterUserUseCase } from './RegisterUserUseCase.js';
import { EmailAlreadyRegisteredError } from '../../domain/errors.js';
import type { User, Household, HouseholdMembership } from '../../domain/entities.js';

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

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: TEST_HOUSEHOLD_ID,
    name: "alice's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeMembership(overrides: Partial<HouseholdMembership> = {}): HouseholdMembership {
  return {
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    role: 'owner',
    joinedAt: new Date(),
    ...overrides,
  };
}

describe('RegisterUserUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let passwordHashing: ReturnType<typeof mock<PasswordHashing>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    passwordHashing = mock<PasswordHashing>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new RegisterUserUseCase(
      userRepo,
      householdRepo,
      passwordHashing,
      jwtIssuer,
      refreshTokenStore,
    );
  });

  it('registers a new user and returns tokens', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHashing.hash.mockResolvedValue('hashed');
    userRepo.create.mockResolvedValue(makeUser());
    householdRepo.findByUserId.mockResolvedValue(null);
    householdRepo.create.mockResolvedValue(makeHousehold());
    householdRepo.addMember.mockResolvedValue(makeMembership());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.userId).toBe(TEST_USER_ID);
    expect(passwordHashing.hash).toHaveBeenCalledWith('password123');
    expect(userRepo.create).toHaveBeenCalledOnce();
    expect(householdRepo.create).toHaveBeenCalledOnce();
    expect(householdRepo.addMember).toHaveBeenCalledOnce();
  });

  it('throws EmailAlreadyRegisteredError when email is taken', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'password123' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });
});
