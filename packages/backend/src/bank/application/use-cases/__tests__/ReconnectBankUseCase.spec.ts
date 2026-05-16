import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId, EncryptedString } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../../domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { ReconnectBankUseCase } from '../ReconnectBankUseCase.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConnectionInvalidStateError,
} from '../../../domain/errors.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const OTHER_USER_ID = '01900000-0000-7000-8000-000000000099' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_CONNECTION_ID = '01900000-0000-7000-8000-000000000003' as BankConnectionId;

function makeConnection(
  overrides?: Partial<BankConnection>,
): BankConnection {
  return {
    id: TEST_CONNECTION_ID,
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: 'ref-123',
    encryptedConsent: null,
    expiresAt: new Date('2024-01-01'),
    status: 'expired',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ReconnectBankUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let useCase: ReconnectBankUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    registry = mock<BankConnectorRegistry>();
    useCase = new ReconnectBankUseCase(connectionRepo, registry);
  });

  it('returns a consent URL for an expired connection', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection({ status: 'expired' }));
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks: vi.fn(),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn().mockResolvedValue({ consentUrl: 'https://example.com/consent' }),
      disconnect: vi.fn(),
    });

    const result = await useCase.execute({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
      userId: TEST_USER_ID,
      redirectUri: 'https://app.example.com/callback',
    });

    expect(result.consentUrl).toBe('https://example.com/consent');
  });

  it('accepts disconnected and reconnect_required statuses', async () => {
    for (const status of ['disconnected', 'reconnect_required'] as const) {
      connectionRepo.findById.mockResolvedValue(makeConnection({ status }));
      registry.resolve.mockReturnValue({
        provider: 'gocardless',
        listSupportedBanks: vi.fn(),
        initiateConsent: vi.fn(),
        completeConsent: vi.fn(),
        listAccounts: vi.fn(),
        fetchTransactions: vi.fn(),
        refreshConsent: vi.fn().mockResolvedValue({ consentUrl: 'https://example.com/consent' }),
        disconnect: vi.fn(),
      });

      await expect(
        useCase.execute({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
          userId: TEST_USER_ID,
          redirectUri: 'https://app.example.com/callback',
        }),
      ).resolves.toBeDefined();
      }
  });

  it('throws BankConnectionNotFoundError when connection does not exist', async () => {
      connectionRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
          userId: TEST_USER_ID,
          redirectUri: 'https://app.example.com/callback',
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
          redirectUri: 'https://app.example.com/callback',
        }),
      ).rejects.toThrow(BankConnectionForbiddenError);
  });

  it('throws BankConnectionInvalidStateError for active connections', async () => {
      connectionRepo.findById.mockResolvedValue(makeConnection({ status: 'active' }));

      await expect(
        useCase.execute({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
          userId: TEST_USER_ID,
          redirectUri: 'https://app.example.com/callback',
        }),
      ).rejects.toThrow(BankConnectionInvalidStateError);
  });
});
