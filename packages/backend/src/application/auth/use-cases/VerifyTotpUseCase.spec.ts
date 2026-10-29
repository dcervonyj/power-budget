import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { UserId } from '@power-budget/core';
import { VerifyTotpUseCase } from './VerifyTotpUseCase.js';
import { TotpInvalidError } from '../../../domain/auth/errors.js';
import type { TotpAuthenticator } from '../services/TotpAuthenticator.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');

describe('VerifyTotpUseCase', () => {
  let totp: ReturnType<typeof createMock<TotpAuthenticator>>;
  let useCase: VerifyTotpUseCase;

  beforeEach(() => {
    totp = createMock<TotpAuthenticator>();
    useCase = new VerifyTotpUseCase(totp);
  });

  it('confirms the code for the user', async () => {
    await useCase.execute({ userId: TEST_USER_ID, code: '123456' });

    expect(totp.confirm).toHaveBeenCalledWith(TEST_USER_ID, '123456');
  });

  it('propagates a rejected code', async () => {
    totp.confirm.mockRejectedValue(new TotpInvalidError());

    await expect(useCase.execute({ userId: TEST_USER_ID, code: '000000' })).rejects.toThrow(
      TotpInvalidError,
    );
  });
});
