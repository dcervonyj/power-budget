import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../domain/ports.js';
import { GetCurrentUserUseCase } from './GetCurrentUserUseCase.js';
import { UserNotFoundError } from '../../domain/errors.js';
import type { User } from '../../domain/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

function makeUser(): User {
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
  };
}

describe('GetCurrentUserUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let useCase: GetCurrentUserUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    useCase = new GetCurrentUserUseCase(userRepo);
  });

  it('returns the user when found', async () => {
    userRepo.findById.mockResolvedValue(makeUser());

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result.id).toBe(TEST_USER_ID);
    expect(result.email).toBe('alice@example.com');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: TEST_USER_ID })).rejects.toThrow(UserNotFoundError);
  });
});
