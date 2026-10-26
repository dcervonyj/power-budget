import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  UserRegistrationRepository,
  PasswordHashing,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { RegisterUserUseCase } from './RegisterUserUseCase.js';
import { EmailAlreadyRegisteredError } from '../../../domain/auth/errors.js';
import type { NewUserRegistration, User } from '../../../domain/auth/entities.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

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

describe('RegisterUserUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let registrationRepo: ReturnType<typeof mock<UserRegistrationRepository>>;
  let passwordHashing: ReturnType<typeof mock<PasswordHashing>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    registrationRepo = mock<UserRegistrationRepository>();
    passwordHashing = mock<PasswordHashing>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new RegisterUserUseCase(
      userRepo,
      registrationRepo,
      passwordHashing,
      jwtIssuer,
      refreshTokenStore,
    );
  });

  function registeredWith(): NewUserRegistration {
    const registration = registrationRepo.register.mock.calls[0]?.[0];
    if (registration === undefined) {
      throw new Error('register was not called');
    }

    return registration;
  }

  it('writes user, household and membership in one registration and returns tokens', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHashing.hash.mockResolvedValue('hashed');
    registrationRepo.register.mockResolvedValue();
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({
      email: 'alice@example.com',
      password: 'password123',
      locale: 'pl',
    });

    expect(registrationRepo.register).toHaveBeenCalledOnce();
    const { user, household } = registeredWith();
    expect(UserId.isValid(user.id)).toBe(true);
    expect(HouseholdId.isValid(household.id)).toBe(true);
    expect(user).toEqual({
      id: user.id,
      email: 'alice@example.com',
      displayName: 'alice',
      defaultLocale: 'pl',
      passwordHash: 'hashed',
    });
    expect(household).toEqual({
      id: household.id,
      name: "alice's household",
      baseCurrency: 'PLN',
    });
    expect(passwordHashing.hash).toHaveBeenCalledWith('password123');
    expect(jwtIssuer.issue).toHaveBeenCalledWith({ userId: user.id, householdId: household.id });
    expect(refreshTokenStore.issue).toHaveBeenCalledWith(user.id, REFRESH_TOKEN_TTL_SECONDS);
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userId: user.id,
    });
  });

  it('throws EmailAlreadyRegisteredError when email is taken, before hashing', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'password123' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
    expect(passwordHashing.hash).not.toHaveBeenCalled();
    expect(registrationRepo.register).not.toHaveBeenCalled();
  });

  it('issues no tokens when the registration write fails', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHashing.hash.mockResolvedValue('hashed');
    registrationRepo.register.mockRejectedValue(new EmailAlreadyRegisteredError());

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'password123' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
    expect(jwtIssuer.issue).not.toHaveBeenCalled();
    expect(refreshTokenStore.issue).not.toHaveBeenCalled();
  });
});
