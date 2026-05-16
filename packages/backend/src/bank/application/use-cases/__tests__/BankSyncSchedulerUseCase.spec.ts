import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectionId, HouseholdId, UserId, EncryptedString } from '@power-budget/core';
import type { BankConnectionRepository } from '../../../domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { BankSyncSchedulerUseCase } from '../BankSyncSchedulerUseCase.js';

const HOUSEHOLD_A = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const HOUSEHOLD_B = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const CONN_1 = '01900000-0000-7000-8000-000000000010' as BankConnectionId;
const CONN_2 = '01900000-0000-7000-8000-000000000011' as BankConnectionId;
const USER_ID = '01900000-0000-7000-8000-000000000020' as UserId;

function makeConnection(id: BankConnectionId, householdId: HouseholdId): BankConnection {
  return {
    id,
    householdId,
    userId: USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: 'ref-1',
    encryptedConsent: 'token' as EncryptedString,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
  };
}

describe('BankSyncSchedulerUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let useCase: BankSyncSchedulerUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    useCase = new BankSyncSchedulerUseCase(connectionRepo);
  });

  it('returns empty array when there are no active connections', async () => {
    connectionRepo.findActiveConnections.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('maps each active connection to a ScheduledSyncTarget', async () => {
    connectionRepo.findActiveConnections.mockResolvedValue([
      makeConnection(CONN_1, HOUSEHOLD_A),
      makeConnection(CONN_2, HOUSEHOLD_B),
    ]);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ connectionId: CONN_1, householdId: HOUSEHOLD_A });
    expect(result[1]).toEqual({ connectionId: CONN_2, householdId: HOUSEHOLD_B });
  });

  it('delegates to connectionRepo.findActiveConnections', async () => {
    connectionRepo.findActiveConnections.mockResolvedValue([]);

    await useCase.execute();

    expect(connectionRepo.findActiveConnections).toHaveBeenCalledOnce();
  });
});
