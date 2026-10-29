import { describe, it, expect, vi } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { UserId } from '@power-budget/core';
import type { UserRepository } from '../../../domain/auth/ports.js';
import { GetCurrentUserUseCase } from './GetCurrentUserUseCase.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import type { User } from '../../../domain/auth/entities.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');

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
  it('returns the user when found', async () => {
    const userRepo = createMock<UserRepository>({
      findById: vi.fn().mockResolvedValue(makeUser()),
    });
    const useCase = new GetCurrentUserUseCase(userRepo);

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result.id).toBe(TEST_USER_ID);
    expect(result.email).toBe('alice@example.com');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const userRepo = createMock<UserRepository>({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetCurrentUserUseCase(userRepo);

    await expect(useCase.execute({ userId: TEST_USER_ID })).rejects.toThrow(UserNotFoundError);
  });
});
