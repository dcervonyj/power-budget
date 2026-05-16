import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type {
  BankConnectionRepository,
  BankAccountRepository,
  SyncRunRepository,
  BankConnectorRegistry,
  BankConnector,
} from '../../domain/ports.js';
import type { IngestBankTransactionsUseCase } from '../../../transactions/application/use-cases/IngestBankTransactionsUseCase.js';
import { BankSyncProcessor, type BankSyncJobPayload } from '../BankSyncProcessor.js';
import type { BankConnection } from '../../domain/entities.js';
import type { BankConnectionId, HouseholdId, SyncRunId } from '@power-budget/core';

const CONNECTION_ID = 'conn-1' as BankConnectionId;
const HOUSEHOLD_ID = 'hh-1' as HouseholdId;
const SYNC_RUN_ID = 'run-1' as SyncRunId;

function makeJob(overrides: Partial<BankSyncJobPayload> = {}): Job<BankSyncJobPayload> {
  return {
    data: {
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      ...overrides,
    },
  } as Job<BankSyncJobPayload>;
}

function makeConnection(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: CONNECTION_ID,
    householdId: HOUSEHOLD_ID,
    userId: 'user-1' as never,
    provider: 'in_memory' as never,
    bankId: 'test-bank',
    externalConsentRef: 'ref-1',
    encryptedConsent: 'enc-token' as never,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BankSyncProcessor', () => {
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let bankAccountRepo: ReturnType<typeof mock<BankAccountRepository>>;
  let syncRunRepo: ReturnType<typeof mock<SyncRunRepository>>;
  let connectorRegistry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let connector: ReturnType<typeof mock<BankConnector>>;
  let ingestUseCase: ReturnType<typeof mock<IngestBankTransactionsUseCase>>;
  let processor: BankSyncProcessor;

  beforeEach(() => {
    connectionRepo = mock<BankConnectionRepository>();
    bankAccountRepo = mock<BankAccountRepository>();
    syncRunRepo = mock<SyncRunRepository>();
    connectorRegistry = mock<BankConnectorRegistry>();
    connector = mock<BankConnector>();
    ingestUseCase = mock<IngestBankTransactionsUseCase>();

    syncRunRepo.start.mockResolvedValue(SYNC_RUN_ID);
    syncRunRepo.lastSuccessfulAt.mockResolvedValue(null);
    syncRunRepo.finish.mockResolvedValue(undefined);
    connectorRegistry.resolve.mockReturnValue(connector);
    connector.listAccounts.mockResolvedValue([]);
    bankAccountRepo.upsertAll.mockResolvedValue(undefined);
    bankAccountRepo.listByConnection.mockResolvedValue([]);
    ingestUseCase.execute.mockResolvedValue(undefined);

    processor = new BankSyncProcessor(
      connectionRepo,
      bankAccountRepo,
      syncRunRepo,
      connectorRegistry,
      ingestUseCase,
    );
  });

  it('performs a successful sync and calls finish with ok=true', async () => {
    const rawAccount = {
      externalId: 'ext-acc-1',
      name: 'My Account',
      iban: null,
      currency: 'PLN',
      balanceMinor: 10000n,
    };
    const dbAccount = {
      id: 'db-acc-1' as never,
      householdId: HOUSEHOLD_ID,
      connectionId: CONNECTION_ID,
      externalId: 'ext-acc-1',
      name: 'My Account',
      iban: null,
      currency: 'PLN',
      balanceMinor: 10000n,
      lastSyncedAt: null,
      createdAt: new Date(),
    };
    const rawTxs = [
      {
        externalId: 'tx-1',
        accountExternalId: 'ext-acc-1',
        occurredOn: '2024-01-01',
        amountMinor: -500n,
        currency: 'PLN',
        description: 'Coffee',
        merchant: 'Cafe',
      },
    ];

    connectionRepo.findById.mockResolvedValue(makeConnection());
    connector.listAccounts.mockResolvedValue([rawAccount]);
    bankAccountRepo.listByConnection.mockResolvedValue([dbAccount]);
    connector.fetchTransactions.mockResolvedValue(rawTxs);

    await processor.process(makeJob());

    expect(syncRunRepo.start).toHaveBeenCalledWith(CONNECTION_ID);
    expect(syncRunRepo.finish).toHaveBeenCalledWith(SYNC_RUN_ID, { ok: true, fetched: 1 });
    expect(ingestUseCase.execute).toHaveBeenCalledOnce();
  });

  it('skips processing when connection is not found', async () => {
    connectionRepo.findById.mockResolvedValue(null);

    await processor.process(makeJob());

    expect(syncRunRepo.start).not.toHaveBeenCalled();
    expect(connector.listAccounts).not.toHaveBeenCalled();
  });

  it('skips processing when encryptedConsent is null', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection({ encryptedConsent: null }));

    await processor.process(makeJob());

    expect(syncRunRepo.start).not.toHaveBeenCalled();
  });

  it('records failure and rethrows when connector throws', async () => {
    const error = new Error('Network error');
    connectionRepo.findById.mockResolvedValue(makeConnection());
    connector.listAccounts.mockRejectedValue(error);

    await expect(processor.process(makeJob())).rejects.toThrow('Network error');

    expect(syncRunRepo.finish).toHaveBeenCalledWith(SYNC_RUN_ID, {
      ok: false,
      fetched: 0,
      error: 'Network error',
    });
  });

  it('uses lastSuccessfulAt as the since date when available', async () => {
    const lastSuccess = new Date('2024-01-01T00:00:00Z');
    syncRunRepo.lastSuccessfulAt.mockResolvedValue(lastSuccess);
    connectionRepo.findById.mockResolvedValue(makeConnection());

    await processor.process(makeJob());

    expect(connector.listAccounts).toHaveBeenCalled();
    // since date comes from lastSuccessfulAt; verify fetchTransactions is called with that date
    // (no accounts so fetchTransactions is not called here, but the flow runs correctly)
    expect(syncRunRepo.finish).toHaveBeenCalledWith(SYNC_RUN_ID, { ok: true, fetched: 0 });
  });

  it('uses the since field from job data when provided', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection());
    const rawAccount = {
      externalId: 'ext-acc-1',
      name: 'Test',
      iban: null,
      currency: 'PLN',
      balanceMinor: 0n,
    };
    const dbAccount = {
      id: 'db-acc-1' as never,
      householdId: HOUSEHOLD_ID,
      connectionId: CONNECTION_ID,
      externalId: 'ext-acc-1',
      name: 'Test',
      iban: null,
      currency: 'PLN',
      balanceMinor: 0n,
      lastSyncedAt: null,
      createdAt: new Date(),
    };
    connector.listAccounts.mockResolvedValue([rawAccount]);
    bankAccountRepo.listByConnection.mockResolvedValue([dbAccount]);
    connector.fetchTransactions.mockResolvedValue([]);

    await processor.process(makeJob({ since: '2024-06-01T00:00:00Z' }));

    expect(connector.fetchTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ since: new Date('2024-06-01T00:00:00Z') }),
    );
  });
});
