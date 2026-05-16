import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectionId, EncryptedString, HouseholdId, UserId } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../../domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import { CompleteBankConsentUseCase } from '../CompleteBankConsentUseCase.js';
import { BankConsentNotFoundError } from '../../../domain/errors.js';

const TEST_CONNECTION_ID = '01900000-0000-7000-8000-000000000001' as BankConnectionId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000003' as UserId;
const EXTERNAL_REF = 'gocardless-ref-abc';

function makeConnection(overrides?: Partial<BankConnection>): BankConnection {
  return {
    id: TEST_CONNECTION_ID,
    householdId: TEST_HOUSEHOLD_ID,
    userId: TEST_USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: EXTERNAL_REF,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CompleteBankConsentUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let useCase: CompleteBankConsentUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    registry = mock<BankConnectorRegistry>();
    useCase = new CompleteBankConsentUseCase(connectionRepo, registry);
  });

  it('completes consent and marks connection active', async () => {
    const expiresAt = new Date('2025-12-31');
    connectionRepo.findByExternalConsentRef.mockResolvedValue(makeConnection());
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks: vi.fn(),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn().mockResolvedValue({
        consentToken: 'new-token' as EncryptedString,
        expiresAt,
      }),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    });
    connectionRepo.updateConsent.mockResolvedValue(undefined);
    connectionRepo.markActive.mockResolvedValue(undefined);

    const result = await useCase.execute({
      externalConsentRef: EXTERNAL_REF,
      callbackPayload: { code: 'auth-code' },
    });

    expect(result).toEqual({ connectionId: TEST_CONNECTION_ID });
    expect(connectionRepo.updateConsent).toHaveBeenCalledWith(
      TEST_CONNECTION_ID,
      'new-token',
      expiresAt,
    );
    expect(connectionRepo.markActive).toHaveBeenCalledWith(TEST_CONNECTION_ID);
  });

  it('throws BankConsentNotFoundError when no connection matches the ref', async () => {
    connectionRepo.findByExternalConsentRef.mockResolvedValue(null);

    await expect(
      useCase.execute({ externalConsentRef: EXTERNAL_REF, callbackPayload: {} }),
    ).rejects.toThrow(BankConsentNotFoundError);
  });

  it('resolves the correct provider from the registry', async () => {
    const expiresAt = new Date('2025-12-31');
    connectionRepo.findByExternalConsentRef.mockResolvedValue(makeConnection());
    const connector = {
      provider: 'gocardless' as const,
      listSupportedBanks: vi.fn(),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn().mockResolvedValue({ consentToken: 'token' as EncryptedString, expiresAt }),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    };
    registry.resolve.mockReturnValue(connector);
    connectionRepo.updateConsent.mockResolvedValue(undefined);
    connectionRepo.markActive.mockResolvedValue(undefined);

    await useCase.execute({ externalConsentRef: EXTERNAL_REF, callbackPayload: {} });

    expect(registry.resolve).toHaveBeenCalledWith('gocardless');
    expect(connector.completeConsent).toHaveBeenCalledWith({
      externalConsentRef: EXTERNAL_REF,
      callbackPayload: {},
    });
  });
});
