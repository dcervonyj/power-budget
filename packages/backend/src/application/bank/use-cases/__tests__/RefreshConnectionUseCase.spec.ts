import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type { BankConnectionRepository, BankSyncQueuePort } from '../../../../domain/bank/ports.js';
import type { BankConnection } from '../../../../domain/bank/entities.js';
import { RefreshConnectionUseCase } from '../RefreshConnectionUseCase.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
} from '../../../../domain/bank/errors.js';

// Moved from the mock-only __tests__/tenancy.spec.ts (CLN-017): the household scoping
// itself is proven against Postgres RLS in tenancy.integration.spec.ts; this covers the
// use case's own rules (scoped lookup, owner check, what gets enqueued).
const USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const OTHER_USER_ID = UserId.of('01900000-0000-7000-8000-000000000099');
const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000002');
const CONNECTION_ID = BankConnectionId.of('01900000-0000-7000-8000-000000000003');

function makeConnection(userId: UserId): BankConnection {
  return {
    id: CONNECTION_ID,
    householdId: HOUSEHOLD_ID,
    userId,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: null,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('RefreshConnectionUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let syncQueue: ReturnType<typeof mock<BankSyncQueuePort>>;
  let useCase: RefreshConnectionUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    syncQueue = mock<BankSyncQueuePort>();
    useCase = new RefreshConnectionUseCase(connectionRepo, syncQueue);
  });

  it('looks the connection up in the caller household and enqueues a sync for it', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection(USER_ID));
    syncQueue.enqueue.mockResolvedValue({ jobId: 'job-1' });

    const result = await useCase.execute({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(connectionRepo.findById).toHaveBeenCalledWith(CONNECTION_ID, {
      householdId: HOUSEHOLD_ID,
    });
    expect(syncQueue.enqueue).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
    });
  });

  it('throws BankConnectionNotFoundError when the scoped lookup finds nothing', async () => {
    connectionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ connectionId: CONNECTION_ID, householdId: HOUSEHOLD_ID, userId: USER_ID }),
    ).rejects.toThrow(BankConnectionNotFoundError);
    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });

  it("throws BankConnectionForbiddenError for the partner's connection", async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection(OTHER_USER_ID));

    await expect(
      useCase.execute({ connectionId: CONNECTION_ID, householdId: HOUSEHOLD_ID, userId: USER_ID }),
    ).rejects.toThrow(BankConnectionForbiddenError);
    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });
});
