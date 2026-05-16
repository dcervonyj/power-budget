import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { UserId, HouseholdId } from '@power-budget/core';
import { JwtAccessTokenIssuerAdapter } from '../JwtAccessTokenIssuer.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_SECRET = 'test-jwt-secret-for-issuer';

describe('JwtAccessTokenIssuerAdapter', () => {
  let issuer: JwtAccessTokenIssuerAdapter;
  let configService: ReturnType<typeof mock<ConfigService>>;

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.get.mockReturnValue(TEST_SECRET);
    issuer = new JwtAccessTokenIssuerAdapter(configService);
  });

  it('issues a token with userId and householdId claims', () => {
    const token = issuer.issue({ userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID });
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.sub).toBe(TEST_USER_ID);
    expect(decoded.householdId).toBe(TEST_HOUSEHOLD_ID);
  });

  it('issues a token that can be verified with the secret', () => {
    const token = issuer.issue({ userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID });
    expect(() => jwt.verify(token, TEST_SECRET)).not.toThrow();
  });

  it('token contains expiry (exp claim)', () => {
    const token = issuer.issue({ userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID });
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.exp).toBeDefined();
  });

  it('handles null householdId in token payload', () => {
    const token = issuer.issue({ userId: TEST_USER_ID, householdId: null });
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.householdId).toBeNull();
  });
});
