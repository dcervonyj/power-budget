import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type { UserRepository, TotpVerifier, TotpSecretRepository } from '../../domain/ports.js';
import { EnableTotpUseCase } from './EnableTotpUseCase.js';
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

describe('EnableTotpUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let totpVerifier: ReturnType<typeof mock<TotpVerifier>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let useCase: EnableTotpUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    totpVerifier = mock<TotpVerifier>();
    totpSecretRepo = mock<TotpSecretRepository>();
    useCase = new EnableTotpUseCase(userRepo, totpVerifier, totpSecretRepo);
  });

  it('generates a TOTP secret and returns qrCodeUri and secret', async () => {
    userRepo.findById.mockResolvedValue(makeUser());
    totpVerifier.generateSecret.mockReturnValue({
      secret: 'BASE32SECRET',
      otpauthUri: 'otpauth://totp/alice?secret=BASE32SECRET',
    });
    totpSecretRepo.save.mockResolvedValue(undefined);

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result.secret).toBe('BASE32SECRET');
    expect(result.qrCodeUri).toBe('otpauth://totp/alice?secret=BASE32SECRET');
    expect(totpSecretRepo.save).toHaveBeenCalledOnce();
    const [savedSecret] = totpSecretRepo.save.mock.calls[0]!;
    expect(savedSecret.verifiedAt).toBeNull();
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: TEST_USER_ID })).rejects.toThrow(UserNotFoundError);
  });
});
