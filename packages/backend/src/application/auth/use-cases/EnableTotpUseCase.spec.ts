import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../../domain/auth/ports.js';
import { EnableTotpUseCase } from './EnableTotpUseCase.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import type { User } from '../../../domain/auth/entities.js';
import type { TotpAuthenticator } from '../services/TotpAuthenticator.js';

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

describe('EnableTotpUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let totp: ReturnType<typeof mock<TotpAuthenticator>>;
  let useCase: EnableTotpUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    totp = mock<TotpAuthenticator>();
    useCase = new EnableTotpUseCase(userRepo, totp);
  });

  it('enrols the user and returns the secret and QR code URI', async () => {
    const user = makeUser();
    userRepo.findById.mockResolvedValue(user);
    totp.enrol.mockResolvedValue({ qrCodeUri: 'otpauth://totp/x', secret: 'BASE32SECRET' });

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result).toEqual({ qrCodeUri: 'otpauth://totp/x', secret: 'BASE32SECRET' });
    expect(totp.enrol).toHaveBeenCalledWith(user);
  });

  it('throws UserNotFoundError when the user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: TEST_USER_ID })).rejects.toThrow(UserNotFoundError);
    expect(totp.enrol).not.toHaveBeenCalled();
  });
});
