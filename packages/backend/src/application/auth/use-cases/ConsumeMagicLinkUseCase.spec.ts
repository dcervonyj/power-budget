import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  UserRepository,
  HouseholdRepository,
  MagicLinkTokenRepository,
  JwtAccessTokenIssuer,
  RefreshTokenStore,
} from '../../../domain/auth/ports.js';
import { ConsumeMagicLinkUseCase } from './ConsumeMagicLinkUseCase.js';
import { MagicLinkExpiredError } from '../../../domain/auth/errors.js';
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

describe('ConsumeMagicLinkUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let magicLinkTokenRepo: ReturnType<typeof mock<MagicLinkTokenRepository>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: ConsumeMagicLinkUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    magicLinkTokenRepo = mock<MagicLinkTokenRepository>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new ConsumeMagicLinkUseCase(
      userRepo,
      householdRepo,
      magicLinkTokenRepo,
      jwtIssuer,
      refreshTokenStore,
    );
  });

  it('issues tokens when magic link token is valid', async () => {
    magicLinkTokenRepo.consume.mockResolvedValue({ userId: TEST_USER_ID });
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());
    jwtIssuer.issue.mockReturnValue('access-token');
    refreshTokenStore.issue.mockResolvedValue('refresh-token');

    const result = await useCase.execute({ token: 'raw-token-value' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.userId).toBe(TEST_USER_ID);
  });

  it('throws MagicLinkExpiredError when token is invalid or already consumed', async () => {
    magicLinkTokenRepo.consume.mockResolvedValue(null);

    await expect(useCase.execute({ token: 'bad-token' })).rejects.toThrow(MagicLinkExpiredError);
  });
});
