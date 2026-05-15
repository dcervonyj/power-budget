import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { mock } from 'vitest-mock-extended';
import type { ExecutionContext } from '@nestjs/common';
import type { TotpStepUpStore } from '../../../../domain/auth/ports.js';
import { TotpStepUpGuard } from '../TotpStepUpGuard.js';
import type { RedisTotpStepUpStore } from '../../../../infrastructure/auth/RedisTotpStepUpStore.js';
import type { UserId } from '@power-budget/core';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

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

describe('TotpStepUpGuard', () => {
  let stepUpStore: ReturnType<typeof mock<TotpStepUpStore>>;
  let reflector: Reflector;
  let guard: TotpStepUpGuard;

  beforeEach(() => {
    stepUpStore = mock<TotpStepUpStore>();
    reflector = new Reflector();
    guard = new TotpStepUpGuard(reflector, stepUpStore as unknown as RedisTotpStepUpStore);
  });

  it('passes when no @RequireRecentTotp metadata present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext(TEST_USER_ID);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns 403 when TOTP stamp is not recent', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(false);
    const ctx = makeContext(TEST_USER_ID);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('passes when TOTP stamp is recent', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    stepUpStore.isRecent.mockResolvedValue(true);
    const ctx = makeContext(TEST_USER_ID);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns 403 when no user on request', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(5);
    const ctx = makeContext(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
