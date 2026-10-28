import { describe, it, expect, beforeEach } from 'vitest';
import { makeBankSyncJob } from '../../../test/doubles/bankSyncJob.js';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type {
  BankConnectionRepository,
  BankAccountRepository,
  SyncRunRepository,
  BankConnectorRegistry,
  BankConnector,
} from '../../../domain/bank/ports.js';
import type { IngestBankTransactionsUseCase } from '../../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { BankSyncProcessor, type BankSyncJobPayload } from '../BankSyncProcessor.js';
import type { BankConnection, RawTransaction } from '../../../domain/bank/entities.js';
import {
  BankAccountId,
  BankConnectionId,
  EncryptedString,
  HouseholdId,
  SyncRunId,
  UserId,
} from '@power-budget/core';
import { testUuid } from '../../../test/doubles/testUuid.js';
import { makeBankAccount, makeBankConnection } from '../../../test/doubles/transactions.js';
import { IsoDate } from '@power-budget/core';

const CONNECTION_ID = BankConnectionId.of('01900000-78db-7ecf-8203-561e43789f28');
const HOUSEHOLD_ID = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const SYNC_RUN_ID = SyncRunId.of('01900000-bc3f-7172-888b-8556e34db1e3');

function makeJob(overrides: Partial<BankSyncJobPayload> = {}): Job<BankSyncJobPayload> {
  return makeBankSyncJob({
    connectionId: CONNECTION_ID,
    householdId: HOUSEHOLD_ID,
    trigger: 'scheduled',
    attended: false,
    ...overrides,
  });
}

function makeConnection(overrides: Partial<BankConnection> = {}): BankConnection {
  return makeBankConnection({
    id: CONNECTION_ID,
    householdId: HOUSEHOLD_ID,
    userId: UserId.of(testUuid('user-1')),
    bankId: 'test-bank',
    externalConsentRef: 'ref-1',
    encryptedConsent: EncryptedString.of('enc-token'),
    createdAt: new Date(),
    ...overrides,
  });
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
    const dbAccount = makeBankAccount({
      id: BankAccountId.of(testUuid('db-acc-1')),
      householdId: HOUSEHOLD_ID,
      connectionId: CONNECTION_ID,
      externalId: 'ext-acc-1',
      name: 'My Account',
      balanceMinor: 10000n,
    });
    const rawTxs: RawTransaction[] = [
      {
        accountExternalId: 'ext-acc-1',
        status: 'booked',
        entryReference: 'tx-1',
        bookingDate: IsoDate.of('2024-01-01'),
        valueDate: null,
        transactionDate: null,
        amountMinor: -500n,
        currency: 'PLN',
        direction: 'debit',
        originalAmount: null,
        counterpartyName: 'Cafe',
        counterpartyIban: null,
        remittance: 'Coffee',
        mcc: null,
        bankTxCode: null,
        balanceAfter: null,
      },
    ];

    connectionRepo.findById.mockResolvedValue(makeConnection());
    connector.listAccounts.mockResolvedValue([rawAccount]);
    bankAccountRepo.listByConnection.mockResolvedValue([dbAccount]);
    connector.fetchTransactions.mockResolvedValue(rawTxs);

    await processor.process(makeJob());

    expect(syncRunRepo.start).toHaveBeenCalledWith(CONNECTION_ID, {
      trigger: 'scheduled',
      attended: false,
    });
    expect(syncRunRepo.finish).toHaveBeenCalledWith(SYNC_RUN_ID, { ok: true, fetched: 1 });
    expect(ingestUseCase.execute).toHaveBeenCalledOnce();
  });

  it('passes the trigger and attended flag of a manual refresh to the sync run', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection());
    connector.listAccounts.mockResolvedValue([]);
    bankAccountRepo.listByConnection.mockResolvedValue([]);

    await processor.process(makeJob({ trigger: 'manual', attended: true }));

    expect(syncRunRepo.start).toHaveBeenCalledWith(CONNECTION_ID, {
      trigger: 'manual',
      attended: true,
    });
  });

  it('treats a job queued before BNK-003 (no trigger) as scheduled and unattended', async () => {
    connectionRepo.findById.mockResolvedValue(makeConnection());
    connector.listAccounts.mockResolvedValue([]);
    bankAccountRepo.listByConnection.mockResolvedValue([]);
    const legacyData: BankSyncJobPayload = {
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
    };

    await processor.process(makeBankSyncJob(legacyData));

    expect(syncRunRepo.start).toHaveBeenCalledWith(CONNECTION_ID, {
      trigger: 'scheduled',
      attended: false,
    });
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

  // CLN-038 (BE-BUGS-08): a job queued before a disconnect must not use a leftover consent.
  it.each(['disconnected', 'pending', 'expired', 'reconnect_required'] as const)(
    'skips a %s connection even when a consent is left over',
    async (status) => {
      connectionRepo.findById.mockResolvedValue(makeConnection({ status }));

      await processor.process(makeJob());

      expect(syncRunRepo.start).not.toHaveBeenCalled();
      expect(connector.listAccounts).not.toHaveBeenCalled();
    },
  );

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

  describe('default since', () => {
    const DAY_MS = 24 * 3600 * 1000;

    beforeEach(() => {
      connectionRepo.findById.mockResolvedValue(makeConnection());
      connector.listAccounts.mockResolvedValue([
        { externalId: 'ext-acc-1', name: 'A', iban: null, currency: 'PLN', balanceMinor: 0n },
      ]);
      bankAccountRepo.listByConnection.mockResolvedValue([
        makeBankAccount({ id: BankAccountId.of(testUuid('db-acc-1')), externalId: 'ext-acc-1' }),
      ]);
      connector.fetchTransactions.mockResolvedValue([]);
    });

    function fetchedFrom(): Date {
      const call = connector.fetchTransactions.mock.calls[0];
      if (call === undefined) {
        throw new Error('fetchTransactions was not called');
      }

      return call[0].dateFrom;
    }

    it('resumes from the last success minus the overlap window', async () => {
      const lastSuccess = new Date('2024-01-10T00:00:00Z');
      syncRunRepo.lastSuccessfulAt.mockResolvedValue(lastSuccess);

      await processor.process(makeJob());

      expect(fetchedFrom()).toEqual(
        new Date(lastSuccess.getTime() - BankSyncProcessor.OVERLAP_DAYS * DAY_MS),
      );
    });

    it('looks 90 days back on the first sync', async () => {
      const before = Date.now();

      await processor.process(makeJob());

      const expected = before - BankSyncProcessor.INITIAL_LOOKBACK_DAYS * DAY_MS;
      expect(Math.abs(fetchedFrom().getTime() - expected)).toBeLessThan(5_000);
    });

    it('reads the watermark before start() inserts the new run', async () => {
      await processor.process(makeJob());

      const read = syncRunRepo.lastSuccessfulAt.mock.invocationCallOrder[0] ?? Infinity;
      const started = syncRunRepo.start.mock.invocationCallOrder[0] ?? 0;
      expect(read).toBeLessThan(started);
    });
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
    const dbAccount = makeBankAccount({
      id: BankAccountId.of(testUuid('db-acc-1')),
      householdId: HOUSEHOLD_ID,
      connectionId: CONNECTION_ID,
      externalId: 'ext-acc-1',
      name: 'Test',
    });
    connector.listAccounts.mockResolvedValue([rawAccount]);
    bankAccountRepo.listByConnection.mockResolvedValue([dbAccount]);
    connector.fetchTransactions.mockResolvedValue([]);

    await processor.process(makeJob({ since: '2024-06-01T00:00:00Z' }));

    expect(connector.fetchTransactions).toHaveBeenCalledWith({
      account: { externalId: 'ext-acc-1' },
      consent: 'enc-token',
      dateFrom: new Date('2024-06-01T00:00:00Z'),
      strategy: 'default',
      psu: null,
    });
  });
});
