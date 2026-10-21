import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import { VerifyTotpUseCase } from './VerifyTotpUseCase.js';
import { TotpInvalidError } from '../../../domain/auth/errors.js';
import type { TotpAuthenticator } from '../services/TotpAuthenticator.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

describe('VerifyTotpUseCase', () => {
  let totp: ReturnType<typeof mock<TotpAuthenticator>>;
  let useCase: VerifyTotpUseCase;

  beforeEach(() => {
    totp = mock<TotpAuthenticator>();
    useCase = new VerifyTotpUseCase(totp);
  });

  it('verifies the code for the user', async () => {
    await useCase.execute({ userId: TEST_USER_ID, code: '123456' });

    expect(totp.verify).toHaveBeenCalledWith(TEST_USER_ID, '123456');
  });

  it('propagates a rejected code', async () => {
    totp.verify.mockRejectedValue(new TotpInvalidError());

    await expect(useCase.execute({ userId: TEST_USER_ID, code: '000000' })).rejects.toThrow(
      TotpInvalidError,
    );
  });
});
