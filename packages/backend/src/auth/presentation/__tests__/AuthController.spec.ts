import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  PasswordHashing,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../domain/ports.js';
import { AuthController } from '../AuthController.js';
import { JwtAuthGuard } from '../guards/JwtAuthGuard.js';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase.js';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase.js';
import type { User, Household, HouseholdMembership } from '../../domain/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_SECRET = 'test-jwt-secret';

function makeUser(overrides: Partial<User> = {}): User {
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
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: TEST_HOUSEHOLD_ID,
    name: "alice's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeMembership(overrides: Partial<HouseholdMembership> = {}): HouseholdMembership {
  return {
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    role: 'owner',
    joinedAt: new Date(),
    ...overrides,
  };
}

describe('AuthController — register', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let passwordHashing: ReturnType<typeof mock<PasswordHashing>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let registerUseCase: RegisterUserUseCase;
  let controller: AuthController;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    passwordHashing = mock<PasswordHashing>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();

    registerUseCase = new RegisterUserUseCase(
      userRepo,
      householdRepo,
      passwordHashing,
      jwtIssuer,
      refreshTokenStore,
    );

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
      mock(),
      mock<ConfigService>(),
    );
  });

  it('calls RegisterUserUseCase with correct args and returns tokens', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHashing.hash.mockResolvedValue('hashed');
    userRepo.create.mockResolvedValue(makeUser());
    householdRepo.findByUserId.mockResolvedValue(null);
    householdRepo.create.mockResolvedValue(makeHousehold());
    householdRepo.addMember.mockResolvedValue(makeMembership());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await controller.register({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(passwordHashing.hash).toHaveBeenCalledWith('password123');
    expect(userRepo.create).toHaveBeenCalledOnce();
  });
});

describe('JwtAuthGuard', () => {
  let configService: ReturnType<typeof mock<ConfigService>>;
  let guard: JwtAuthGuard;

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

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.get.mockReturnValue(TEST_SECRET);
    guard = new JwtAuthGuard(configService);
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
    ctx.switchToHttp.mockReturnValue({
      getRequest: () => request,
    } as ReturnType<ExecutionContext['switchToHttp']>);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((request as { user?: { userId: string } }).user?.userId).toBe(TEST_USER_ID);
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
      mock(),
      refreshUseCase,
      mock(),
      mock<ConfigService>(),
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
