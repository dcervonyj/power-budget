import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, BankConnectionId, HouseholdId, EncryptedString } from '@power-budget/core';
import type { BankConnectionRepository } from '../../../domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { ListUserConnectionsUseCase } from '../ListUserConnectionsUseCase.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const CONN_1 = '01900000-0000-7000-8000-000000000010' as BankConnectionId;
const CONN_2 = '01900000-0000-7000-8000-000000000011' as BankConnectionId;

function makeConnection(id: BankConnectionId): BankConnection {
  return {
    id,
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: 'ref',
    encryptedConsent: 'token' as EncryptedString,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
  };
}

describe('ListUserConnectionsUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let useCase: ListUserConnectionsUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    useCase = new ListUserConnectionsUseCase(connectionRepo);
  });

  it('returns empty array when user has no connections', async () => {
    connectionRepo.listByUser.mockResolvedValue([]);

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result).toEqual([]);
  });

  it('returns all connections for the user', async () => {
    const connections = [makeConnection(CONN_1), makeConnection(CONN_2)];
    connectionRepo.listByUser.mockResolvedValue(connections);

    const result = await useCase.execute({ userId: TEST_USER_ID });

    expect(result).toBe(connections);
    expect(result).toHaveLength(2);
  });

  it('delegates to connectionRepo.listByUser with the correct userId', async () => {
    connectionRepo.listByUser.mockResolvedValue([]);

    await useCase.execute({ userId: TEST_USER_ID });

    expect(connectionRepo.listByUser).toHaveBeenCalledWith(TEST_USER_ID);
  });
});
