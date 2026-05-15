import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { RefreshTokenUseCase } from './RefreshTokenUseCase.js';
import { InvalidCredentialsError } from '../../../domain/auth/errors.js';
import type { Household } from '../../../domain/auth/entities.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makeHousehold(): Household {
  return {
    id: TEST_HOUSEHOLD_ID,
    name: "alice's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
  };
}

describe('RefreshTokenUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new RefreshTokenUseCase(householdRepo, jwtIssuer, refreshTokenStore);
  });

  it('rotates the refresh token and issues a new access token', async () => {
    refreshTokenStore.rotate.mockResolvedValue({
      userId: TEST_USER_ID,
      newToken: 'new-refresh-token',
    });
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('new-access-token');

    const result = await useCase.execute({ refreshToken: 'old-refresh-token' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.userId).toBe(TEST_USER_ID);
  });

  it('throws InvalidCredentialsError when refresh token is invalid or expired', async () => {
    refreshTokenStore.rotate.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'bad-token' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});
