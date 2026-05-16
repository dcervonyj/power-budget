import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId, EncryptedString } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../../domain/ports.js';
import type { AuditLogger } from '../../../../audit/domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { DisconnectBankUseCase } from '../DisconnectBankUseCase.js';
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
    encryptedConsent: 'encrypted-token' as EncryptedString,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('DisconnectBankUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let auditLogger: ReturnType<typeof mock<AuditLogger>>;
  let useCase: DisconnectBankUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    registry = mock<BankConnectorRegistry>();
    auditLogger = mock<AuditLogger>();
    useCase = new DisconnectBankUseCase(connectionRepo, registry, auditLogger);
  });

  it('disconnects a connection and logs the audit event', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection());
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks: vi.fn(),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    });
    connectionRepo.markDisconnected.mockResolvedValue(undefined);
    auditLogger.log.mockResolvedValue(undefined);

    await useCase.execute({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
      userId: TEST_USER_ID,
    });

    expect(connectionRepo.markDisconnected).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledOnce();
    const [event] = auditLogger.log.mock.calls[0]!;
    expect(event.action).toBe('bank.disconnected');
    expect(event.subjectId).toBe(TEST_CONNECTION_ID);
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

  it('skips provider disconnect when no consent token is stored', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection({ encryptedConsent: null }));
    connectionRepo.markDisconnected.mockResolvedValue(undefined);
    auditLogger.log.mockResolvedValue(undefined);

    await useCase.execute({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
      userId: TEST_USER_ID,
    });

    expect(registry.resolve).not.toHaveBeenCalled();
    expect(connectionRepo.markDisconnected).toHaveBeenCalledOnce();
  });
});
