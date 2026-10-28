import { describe, it, expect, beforeEach } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { createHash } from 'node:crypto';
import { mock } from 'vitest-mock-extended';
import { UserId } from '@power-budget/core';
import type { FailedAttemptCounter, MagicLinkTokenRepository } from '../../../domain/auth/ports.js';
import { ConsumeMagicLinkUseCase } from './ConsumeMagicLinkUseCase.js';
import {
  MagicLinkExpiredError,
  TotpInvalidError,
  TotpLockedError,
  TotpRequiredError,
} from '../../../domain/auth/errors.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const RAW_TOKEN = 'raw-token-value';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');
const SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  userId: TEST_USER_ID,
};

describe('ConsumeMagicLinkUseCase', () => {
  let magicLinkTokenRepo: ReturnType<typeof mock<MagicLinkTokenRepository>>;
  let loginPolicy: ReturnType<typeof mock<LoginPolicy>>;
  let attemptCounter: ReturnType<typeof mock<FailedAttemptCounter>>;
  let useCase: ConsumeMagicLinkUseCase;

  beforeEach(() => {
    magicLinkTokenRepo = mock<MagicLinkTokenRepository>();
    loginPolicy = mock<LoginPolicy>();
    loginPolicy.issueSession.mockResolvedValue(SESSION);
    attemptCounter = mock<FailedAttemptCounter>();
    useCase = new ConsumeMagicLinkUseCase(magicLinkTokenRepo, loginPolicy, attemptCounter);
  });

  it('issues a session when the token is live and the second factor passes', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    magicLinkTokenRepo.consume.mockResolvedValue({ userId: TEST_USER_ID });

    const result = await useCase.execute({ token: RAW_TOKEN, totp: '123456' });

    expect(result).toEqual(SESSION);
    expect(magicLinkTokenRepo.find).toHaveBeenCalledWith(TOKEN_HASH);
    expect(loginPolicy.assertSecondFactor).toHaveBeenCalledWith(TEST_USER_ID, '123456');
    expect(magicLinkTokenRepo.consume).toHaveBeenCalledWith(TOKEN_HASH);
    expect(loginPolicy.issueSession).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('throws MagicLinkExpiredError for an unknown or expired token', async () => {
    magicLinkTokenRepo.find.mockResolvedValue(null);

    await expect(useCase.execute({ token: 'expired-token' })).rejects.toThrow(
      MagicLinkExpiredError,
    );
    expect(loginPolicy.assertSecondFactor).not.toHaveBeenCalled();
    expect(magicLinkTokenRepo.consume).not.toHaveBeenCalled();
  });

  it('keeps the link when TOTP is enabled but no code was sent', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpRequiredError());

    await expect(useCase.execute({ token: RAW_TOKEN })).rejects.toThrow(TotpRequiredError);
    expect(magicLinkTokenRepo.consume).not.toHaveBeenCalled();
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
    expect(attemptCounter.increment).not.toHaveBeenCalled();
  });

  it('issues no session for a wrong TOTP code and counts it on the link', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpInvalidError());
    attemptCounter.increment.mockResolvedValue({ attempts: 2, secondsLeft: 800 });

    await expect(useCase.execute({ token: RAW_TOKEN, totp: '000000' })).rejects.toThrow(
      TotpInvalidError,
    );
    expect(attemptCounter.increment).toHaveBeenCalledWith(
      `magic-link-failures:${TOKEN_HASH}`,
      15 * 60,
    );
    expect(magicLinkTokenRepo.consume).not.toHaveBeenCalled();
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });

  it('burns the link with the third wrong code', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpInvalidError());
    attemptCounter.increment.mockResolvedValue({ attempts: 3, secondsLeft: 700 });

    await expect(useCase.execute({ token: RAW_TOKEN, totp: '000000' })).rejects.toThrow(
      TotpInvalidError,
    );
    expect(magicLinkTokenRepo.consume).toHaveBeenCalledWith(TOKEN_HASH);
    expect(attemptCounter.reset).toHaveBeenCalledWith(`magic-link-failures:${TOKEN_HASH}`);
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });

  it('keeps the link while the user is locked out', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    loginPolicy.assertSecondFactor.mockRejectedValue(new TotpLockedError(600));

    await expect(useCase.execute({ token: RAW_TOKEN, totp: '123456' })).rejects.toThrow(
      TotpLockedError,
    );
    expect(attemptCounter.increment).not.toHaveBeenCalled();
    expect(magicLinkTokenRepo.consume).not.toHaveBeenCalled();
  });

  it('throws MagicLinkExpiredError when a concurrent request consumed the link first', async () => {
    magicLinkTokenRepo.find.mockResolvedValue({ userId: TEST_USER_ID });
    magicLinkTokenRepo.consume.mockResolvedValue(null);

    await expect(useCase.execute({ token: RAW_TOKEN })).rejects.toThrow(MagicLinkExpiredError);
    expect(loginPolicy.issueSession).not.toHaveBeenCalled();
  });
});
