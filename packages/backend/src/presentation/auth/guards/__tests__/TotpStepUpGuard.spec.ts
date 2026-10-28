import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { mock } from 'vitest-mock-extended';
import type { ExecutionContext } from '@nestjs/common';
import { EncryptedString, UserId } from '@power-budget/core';
import type { TotpSecretRepository, TotpStepUpStore } from '../../../../domain/auth/ports.js';
import type { TotpSecret } from '../../../../domain/auth/entities.js';
import { TotpStepUpGuard } from '../TotpStepUpGuard.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');

function makeContext(userId: UserId | null): ExecutionContext {
  const request = userId ? { user: { userId, householdId: null } } : {};

  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function makeSecret(verifiedAt: Date | null): TotpSecret {
  return {
    userId: TEST_USER_ID,
    encryptedSecret: EncryptedString.of('env-v1:aes-256-gcm:iv:ct:tag'),
    enrolledAt: new Date(),
    verifiedAt,
    lastUsedTimeStep: null,
    pendingEncryptedSecret: null,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<ForbiddenException> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ForbiddenException) {
      return err;
    }
    throw err;
  }
  throw new Error('expected a ForbiddenException');
}

describe('TotpStepUpGuard', () => {
  let stepUpStore: ReturnType<typeof mock<TotpStepUpStore>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let reflector: Reflector;
  let guard: TotpStepUpGuard;

  beforeEach(() => {
    stepUpStore = mock<TotpStepUpStore>();
    totpSecretRepo = mock<TotpSecretRepository>();
    reflector = new Reflector();
    guard = new TotpStepUpGuard(reflector, stepUpStore, totpSecretRepo);
  });

  it('passes when no @RequireRecentTotp metadata present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext(TEST_USER_ID);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns 403 requires_totp when TOTP is enabled but the stamp is not recent', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(false);
    totpSecretRepo.findByUser.mockResolvedValue(makeSecret(new Date()));

    const err = await rejectionOf(guard.canActivate(makeContext(TEST_USER_ID)));

    expect(err.getResponse()).toEqual({
      code: 'requires_totp',
      message: 'TOTP re-verification required',
    });
  });

  it('returns 403 requires_totp_enrollment when the user has no enabled TOTP', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(false);
    totpSecretRepo.findByUser.mockResolvedValue(makeSecret(null));

    const err = await rejectionOf(guard.canActivate(makeContext(TEST_USER_ID)));

    expect(err.getResponse()).toEqual({
      code: 'requires_totp_enrollment',
      message: 'TOTP enrollment required',
    });
  });

  it('returns 403 requires_totp_enrollment when the user never enrolled', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(false);
    totpSecretRepo.findByUser.mockResolvedValue(null);

    const err = await rejectionOf(guard.canActivate(makeContext(TEST_USER_ID)));

    expect(err.getResponse()).toEqual({
      code: 'requires_totp_enrollment',
      message: 'TOTP enrollment required',
    });
  });

  it('passes when TOTP stamp is recent', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(true);
    const ctx = makeContext(TEST_USER_ID);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(stepUpStore.isRecent).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('returns 403 when no user on request', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    const ctx = makeContext(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
