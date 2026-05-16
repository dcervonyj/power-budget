import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId, EncryptedString } from '@power-budget/core';
import type { BankConnectionRepository, BankSyncQueuePort } from '../../../domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { RefreshConnectionUseCase } from '../RefreshConnectionUseCase.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
} from '../../../domain/errors.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const OTHER_USER_ID = '01900000-0000-7000-8000-000000000099' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_CONNECTION_ID = '01900000-0000-7000-8000-000000000003' as BankConnectionId;

function makeConnection(overrides?: Partial<BankConnection>): BankConnection {
  return {
    id: TEST_CONNECTION_ID,
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: 'ref-123',
    encryptedConsent: 'token' as EncryptedString,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
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

  it('enqueues a sync job and returns the job ID', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection());
    syncQueue.enqueue.mockResolvedValue({ jobId: 'job-42' });

    const result = await useCase.execute({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
      userId: TEST_USER_ID,
    });

    expect(result).toEqual({ jobId: 'job-42' });
    expect(syncQueue.enqueue).toHaveBeenCalledWith({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
    });
  });

  it('throws BankConnectionNotFoundError when connection does not exist', async () => {
    connectionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        connectionId: TEST_CONNECTION_ID,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      }),
    ).rejects.toThrow(BankConnectionNotFoundError);
  });

  it('throws BankConnectionForbiddenError when user does not own the connection', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection({ userId: OTHER_USER_ID }));

    await expect(
      useCase.execute({
        connectionId: TEST_CONNECTION_ID,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      }),
    ).rejects.toThrow(BankConnectionForbiddenError);
  });

  it('does not enqueue when connection is not found', async () => {
    connectionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        connectionId: TEST_CONNECTION_ID,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      }),
    ).rejects.toThrow();

    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });
});
