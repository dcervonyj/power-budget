import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnectorRegistry,
} from '../../../../domain/bank/ports.js';
import type { BankConnection } from '../../../../domain/bank/entities.js';
import { InitiateBankConnectionUseCase } from '../InitiateBankConnectionUseCase.js';
import { BankConnectionAlreadyActiveError } from '../../../../domain/bank/errors.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makeConnection(overrides?: Partial<BankConnection>): BankConnection {
  return {
    id: '01900000-0000-7000-8000-000000000003' as BankConnectionId,
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: 'ref-123',
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('InitiateBankConnectionUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let useCase: InitiateBankConnectionUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    registry = mock<BankConnectorRegistry>();
    useCase = new InitiateBankConnectionUseCase(connectionRepo, registry);
  });

  it('creates a new connection and returns consentUrl and connectionId', async () => {
    connectionRepo.findActiveByUserAndBank.mockResolvedValue(null);
    connectionRepo.create.mockResolvedValue(makeConnection());
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks: vi.fn(),
      initiateConsent: vi.fn().mockResolvedValue({
        consentUrl: 'https://mock.gocardless.test/consent?ref=ref-abc',
        externalConsentRef: 'ref-abc',
      }),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    });

    const result = await useCase.execute({
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      provider: 'gocardless',
      bankId: 'PKO_PLPKOPPLPW',
      redirectUri: 'https://app.test/callback',
    });

    expect(result.consentUrl).toBe('https://mock.gocardless.test/consent?ref=ref-abc');
    expect(result.connectionId).toBeDefined();
    expect(connectionRepo.create).toHaveBeenCalledOnce();
    const [created] = connectionRepo.create.mock.calls[0]!;
    expect(created.bankId).toBe('PKO_PLPKOPPLPW');
    expect(created.provider).toBe('gocardless');
    expect(created.externalConsentRef).toBe('ref-abc');
  });

  it('throws BankConnectionAlreadyActiveError when active connection exists', async () => {
    connectionRepo.findActiveByUserAndBank.mockResolvedValue(makeConnection());

    await expect(
      useCase.execute({
        userId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        provider: 'gocardless',
        bankId: 'PKO_PLPKOPPLPW',
        redirectUri: 'https://app.test/callback',
      }),
    ).rejects.toThrow(BankConnectionAlreadyActiveError);

    expect(connectionRepo.create).not.toHaveBeenCalled();
  });
});
