import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { UnauthorizedException } from '@nestjs/common';
import { parseAppConfig } from '../../../config/AppConfig.js';
import * as jwt from 'jsonwebtoken';
import { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { AuthController } from '../AuthController.js';
import { JwtAuthGuard } from '../guards/JwtAuthGuard.js';
import type { RegisterUserUseCase } from '../../../application/auth/use-cases/RegisterUserUseCase.js';
import { RefreshTokenUseCase } from '../../../application/auth/use-cases/RefreshTokenUseCase.js';
import type { Household } from '../../../domain/auth/entities.js';

const TEST_USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const TEST_HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000002');
const TEST_SECRET = 'unit-test-jwt-secret-with-at-least-32-bytes';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: TEST_HOUSEHOLD_ID,
    name: "alice's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthController — register', () => {
  let registerUseCase: ReturnType<typeof mock<RegisterUserUseCase>>;
  let controller: AuthController;

  beforeEach(() => {
    registerUseCase = mock<RegisterUserUseCase>();

    // Build controller with all other use cases as mocks
    controller = new AuthController(
      registerUseCase,
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
    );
  });

  it('calls RegisterUserUseCase with correct args and returns tokens', async () => {
    registerUseCase.execute.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userId: TEST_USER_ID,
    });

    const result = await controller.register({
      email: 'alice@example.com',
      password: 'password123',
      locale: 'pl',
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userId: TEST_USER_ID,
    });
    expect(registerUseCase.execute).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password123',
      locale: 'pl',
    });
  });
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  function makeContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: { authorization: authHeader },
    };
    const ctx = mock<ExecutionContext>();
    ctx.switchToHttp.mockReturnValue(
      mock<HttpArgumentsHost>({ getRequest: vi.fn().mockReturnValue(request) }),
    );

    return ctx;
  }

  beforeEach(() => {
    const config = parseAppConfig(
      {
        NODE_ENV: 'production',
        JWT_SECRET: TEST_SECRET,
        KEK_BASE64: Buffer.alloc(32).toString('base64'),
      },
      'api',
    );
    guard = new JwtAuthGuard(config);
  });

  it('rejects a token forged with the old default secret', () => {
    const forged = jwt.sign(
      { sub: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID },
      'dev-secret-change-me',
    );

    expect(() => guard.canActivate(makeContext(`Bearer ${forged}`))).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with another HMAC algorithm (HS256 is pinned)', () => {
    const hs512 = jwt.sign({ sub: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID }, TEST_SECRET, {
      algorithm: 'HS512',
    });

    expect(() => guard.canActivate(makeContext(`Bearer ${hs512}`))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const ctx = makeContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header does not start with Bearer', () => {
    const ctx = makeContext('Basic abc123');

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an invalid token', () => {
    const ctx = makeContext('Bearer invalid.token.here');

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('returns true and sets request.user for a valid token', () => {
    const token = jwt.sign({ sub: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID }, TEST_SECRET, {
      expiresIn: '15m',
    });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const ctx = mock<ExecutionContext>();
    ctx.switchToHttp.mockReturnValue(
      mock<HttpArgumentsHost>({ getRequest: vi.fn().mockReturnValue(request) }),
    );

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request['user']).toEqual({ userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID });
  });
});

describe('RefreshTokenUseCase wiring — AuthController', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let refreshUseCase: RefreshTokenUseCase;
  let controller: AuthController;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();

    refreshUseCase = new RefreshTokenUseCase(householdRepo, jwtIssuer, refreshTokenStore);

    controller = new AuthController(
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      refreshUseCase,
      mock(),
    );
  });

  it('calls RefreshTokenUseCase and returns new tokens', async () => {
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('new-access-token');
    refreshTokenStore.rotate.mockResolvedValue({
      userId: TEST_USER_ID,
      newToken: 'new-refresh-token',
    });

    const result = await controller.refreshTokenEndpoint({ refreshToken: 'old-refresh-token' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.userId).toBe(TEST_USER_ID);
    expect(refreshTokenStore.rotate).toHaveBeenCalledWith('old-refresh-token');
  });
});
