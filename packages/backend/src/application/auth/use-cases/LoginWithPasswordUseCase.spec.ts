import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { UserId } from '@power-budget/core';
import type { UserRepository, PasswordHashing } from '../../../domain/auth/ports.js';
import { LoginWithPasswordUseCase } from './LoginWithPasswordUseCase.js';
import { InvalidCredentialsError, TotpRequiredError } from '../../../domain/auth/errors.js';
import type { User } from '../../../domain/auth/entities.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  userId: TEST_USER_ID,
};

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

describe('LoginWithPasswordUseCase', () => {
  let userRepo: ReturnType<typeof createMock<UserRepository>>;
  let passwordHashing: ReturnType<typeof createMock<PasswordHashing>>;
  let loginPolicy: ReturnType<typeof createMock<LoginPolicy>>;
  let useCase: LoginWithPasswordUseCase;

  beforeEach(() => {
    userRepo = createMock<UserRepository>();
    passwordHashing = createMock<PasswordHashing>();
    loginPolicy = createMock<LoginPolicy>();
    loginPolicy.issueSession.mockResolvedValue(SESSION);
    useCase = new LoginWithPasswordUseCase(userRepo, passwordHashing, loginPolicy);
  });

  it('checks the second factor, then issues a session', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'alice@example.com',
      password: 'correct',
      totp: '123456',
    });

    expect(result).toEqual(SESSION);
    expect(passwordHashing.verify).toHaveBeenCalledWith('correct', 'hashed');
    expect(loginPolicy.assertSecondFactor).toHaveBeenCalledWith(TEST_USER_ID, '123456');
    expect(loginPolicy.issueSession).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('issues no session when the login policy demands TOTP', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(true);
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpRequiredError());

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'correct' }),
    ).rejects.toThrow(TotpRequiredError);
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsError for a wrong password without checking TOTP', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());
    passwordHashing.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(loginPolicy.assertSecondFactor).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsError for an unknown email', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute({ email: 'nobody@example.com', password: 'x' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('throws InvalidCredentialsError for a user without a password', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: null }));

    await expect(useCase.execute({ email: 'alice@example.com', password: 'x' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(passwordHashing.verify).not.toHaveBeenCalled();
  });
});
