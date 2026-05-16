import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../../domain/ports.js';
import type { TotpSecretRepository } from '../../../../auth/domain/ports.js';
import type { BankConnection } from '../../../domain/entities.js';
import type { TotpSecret } from '../../../../auth/domain/entities.js';
import { InitiateBankConnectionUseCase } from '../InitiateBankConnectionUseCase.js';
import { BankConnectionAlreadyActiveError } from '../../../domain/errors.js';
import { TotpEnrollmentRequiredError } from '../../../../auth/domain/errors.js';

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

function makeTotp(verifiedAt: Date | null = new Date()): TotpSecret {
  return {
    userId: TEST_USER_ID,
    encryptedSecret: 'enc-secret',
    enrolledAt: new Date(),
    verifiedAt,
  };
}

describe('InitiateBankConnectionUseCase', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;
  let useCase: InitiateBankConnectionUseCase;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    registry = mock<BankConnectorRegistry>();
    totpSecretRepo = mock<TotpSecretRepository>();
    useCase = new InitiateBankConnectionUseCase(connectionRepo, registry, totpSecretRepo);
  });

  it('creates a new connection and returns consentUrl and connectionId', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(makeTotp());
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
    totpSecretRepo.findByUser.mockResolvedValue(makeTotp());
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

  it('throws TotpEnrollmentRequiredError when TOTP not enrolled', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        provider: 'gocardless',
        bankId: 'PKO_PLPKOPPLPW',
        redirectUri: 'https://app.test/callback',
      }),
    ).rejects.toThrow(TotpEnrollmentRequiredError);

    expect(connectionRepo.create).not.toHaveBeenCalled();
  });

  it('throws TotpEnrollmentRequiredError when TOTP enrolled but not verified', async () => {
    totpSecretRepo.findByUser.mockResolvedValue(makeTotp(null));

    await expect(
      useCase.execute({
        userId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        provider: 'gocardless',
        bankId: 'PKO_PLPKOPPLPW',
        redirectUri: 'https://app.test/callback',
      }),
    ).rejects.toThrow(TotpEnrollmentRequiredError);

    expect(connectionRepo.create).not.toHaveBeenCalled();
  });
});
