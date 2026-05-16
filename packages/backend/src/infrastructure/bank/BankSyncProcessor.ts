import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankAccountRepository,
  SyncRunRepository,
  BankConnectorRegistry,
} from '../../domain/bank/ports.js';
import type { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { QUEUE_BANK_SYNC } from '../queue/queue.constants.js';

export interface BankSyncJobPayload {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly since?: string; // ISO date string
}

@Processor(QUEUE_BANK_SYNC, { concurrency: 2 })
export class BankSyncProcessor extends WorkerHost {
  private static readonly RECONNECT_REMINDER_DAYS = 7;

  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly bankAccountRepo: BankAccountRepository,
    private readonly syncRunRepo: SyncRunRepository,
    private readonly connectorRegistry: BankConnectorRegistry,
    private readonly ingestUseCase: IngestBankTransactionsUseCase,
  ) {
    super();
  }

  async process(job: Job<BankSyncJobPayload>): Promise<void> {
    const { connectionId, householdId, since } = job.data;
    const scope = { householdId };

    const connection = await this.connectionRepo.findById(connectionId, scope);
    if (connection === null || connection.encryptedConsent === null) {
      return;
    }

    const syncRunId = await this.syncRunRepo.start(connectionId);
    const sinceDt = since ? new Date(since) : await this.getDefaultSince(connectionId);
    let totalFetched = 0;

    try {
      const connector = this.connectorRegistry.resolve(connection.provider);
      const accounts = await connector.listAccounts(
        connectionId,
        connection.encryptedConsent,
      );

      await this.bankAccountRepo.upsertAll(accounts, connectionId, scope);

      const dbAccounts = await this.bankAccountRepo.listByConnection(connectionId, scope);

      for (const rawAccount of accounts) {
        const dbAccount = dbAccounts.find((a) => a.externalId === rawAccount.externalId);
        if (dbAccount === undefined) continue;

        const rawTxs = await connector.fetchTransactions({
          accountExternalId: rawAccount.externalId,
          consent: connection.encryptedConsent,
          since: sinceDt,
        });

        await this.ingestUseCase.execute({
          accountId: dbAccount.id,
          rawTransactions: rawTxs,
          householdId,
        });

        totalFetched += rawTxs.length;
      }

      await this.syncRunRepo.finish(syncRunId, { ok: true, fetched: totalFetched });

      this.checkExpiryReminder(connection);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.syncRunRepo.finish(syncRunId, { ok: false, fetched: 0, error: message });
      throw err;
    }
  }

  private async getDefaultSince(connectionId: BankConnectionId): Promise<Date> {
    const lastSuccess = await this.syncRunRepo.lastSuccessfulAt(connectionId);
    if (lastSuccess !== null) {
      return lastSuccess;
    }
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return ninetyDaysAgo;
  }

  private checkExpiryReminder(connection: { expiresAt: Date | null }): void {
    if (connection.expiresAt === null) return;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(
      sevenDaysFromNow.getDate() + BankSyncProcessor.RECONNECT_REMINDER_DAYS,
    );
    if (connection.expiresAt < sevenDaysFromNow) {
      // In production: enqueue reconnect-reminder notification via outbox
    }
  }
}
