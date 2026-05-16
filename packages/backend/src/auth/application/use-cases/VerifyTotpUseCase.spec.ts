import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type { TotpVerifier, TotpSecretRepository } from '../../domain/ports.js';
import { VerifyTotpUseCase } from './VerifyTotpUseCase.js';
import { TotpInvalidError, UserNotFoundError } from '../../domain/errors.js';
import type { TotpSecret } from '../../domain/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

function makeTotpSecret(): TotpSecret {
  return {
    userId: TEST_USER_ID,
    encryptedSecret: 'BASE32SECRET',
    enrolledAt: new Date(),
    verifiedAt: null,
  };
}

describe('VerifyTotpUseCase', () => {
  let totpVerifier: ReturnType<typeof mock<TotpVerifier>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let useCase: VerifyTotpUseCase;

  beforeEach(() => {
    totpVerifier = mock<TotpVerifier>();
    totpSecretRepo = mock<TotpSecretRepository>();
    useCase = new VerifyTotpUseCase(totpVerifier, totpSecretRepo);
  });

  it('marks TOTP as verified when the code is valid', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());
    totpVerifier.verify.mockReturnValue(true);
    totpSecretRepo.save.mockResolvedValue(undefined);

    await useCase.execute({ userId: TEST_USER_ID, code: '123456' });

    expect(totpSecretRepo.save).toHaveBeenCalledOnce();
    const [savedSecret] = totpSecretRepo.save.mock.calls[0]!;
    expect(savedSecret.verifiedAt).toBeInstanceOf(Date);
  });

  it('throws TotpInvalidError when the code is wrong', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());
    totpVerifier.verify.mockReturnValue(false);

    await expect(useCase.execute({ userId: TEST_USER_ID, code: 'wrong' })).rejects.toThrow(
      TotpInvalidError,
    );
  });

  it('throws UserNotFoundError when TOTP secret does not exist', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(null);

    await expect(useCase.execute({ userId: TEST_USER_ID, code: '123456' })).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
