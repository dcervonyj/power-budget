import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { UserId, HouseholdId } from '@power-budget/core';
import { JwtAuthGuard } from '../JwtAuthGuard.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_SECRET = 'test-jwt-secret-for-guard-test';

function makeContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: { authorization: authHeader },
  };
  const ctx = mock<ExecutionContext>();
  ctx.switchToHttp.mockReturnValue({
    getRequest: () => request,
  } as ReturnType<ExecutionContext['switchToHttp']>);
  return ctx;
}

describe('JwtAuthGuard', () => {
  let configService: ReturnType<typeof mock<ConfigService>>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.get.mockReturnValue(TEST_SECRET);
    guard = new JwtAuthGuard(configService);
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header does not start with Bearer', () => {
    expect(() => guard.canActivate(makeContext('Basic abc123'))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an invalid token', () => {
    expect(() => guard.canActivate(makeContext('Bearer invalid.token.here'))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for an expired JWT', () => {
    const expiredToken = jwt.sign(
      { sub: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID },
      TEST_SECRET,
      { expiresIn: -1 },
    );
    expect(() => guard.canActivate(makeContext(`Bearer ${expiredToken}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true and attaches user payload to request for a valid token', () => {
    const token = jwt.sign({ sub: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID }, TEST_SECRET, {
      expiresIn: '15m',
    });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const ctx = mock<ExecutionContext>();
    ctx.switchToHttp.mockReturnValue({
      getRequest: () => request,
    } as ReturnType<ExecutionContext['switchToHttp']>);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((request as { user?: { userId: string; householdId: string } }).user?.userId).toBe(
      TEST_USER_ID,
    );
    expect((request as { user?: { userId: string; householdId: string } }).user?.householdId).toBe(
      TEST_HOUSEHOLD_ID,
    );
  });
});
