import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankAccountRepository,
  SyncRunRepository,
  SyncRunStartOptions,
  BankConnectorRegistry,
} from '../../domain/bank/ports.js';
import type { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { QUEUE_BANK_SYNC, WORKER_DRAIN_DELAY_SECONDS } from '../queue/queue.constants.js';
import { bullmqBackoffStrategy } from '../queue/retry-config.js';

export interface BankSyncJobPayload {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  /** Absent on jobs queued before BNK-003; they are treated as scheduled, unattended. */
  readonly trigger?: SyncRunStartOptions['trigger'];
  readonly attended?: boolean;
  readonly since?: string; // ISO date string
}

@Processor(QUEUE_BANK_SYNC, {
  concurrency: 2,
  drainDelay: WORKER_DRAIN_DELAY_SECONDS,
  settings: { backoffStrategy: bullmqBackoffStrategy },
})
export class BankSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(BankSyncProcessor.name);
  private legacyPayloadLogged = false;
  private static readonly RECONNECT_REMINDER_DAYS = 7;
  /** First sync of a connection looks this far back. */
  static readonly INITIAL_LOOKBACK_DAYS = 90;
  /**
   * Incremental syncs re-fetch this many days before the last successful run, so
   * transactions the bank booked late (pending to booked, value-date lag) are still
   * picked up; ingest is idempotent, so the overlap only costs a few duplicates to skip.
   */
  static readonly OVERLAP_DAYS = 3;

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
    const runOptions = this.runOptions(job.data);
    const scope = { householdId };

    const connection = await this.connectionRepo.findById(connectionId, scope);
    // A job queued before a disconnect (or for a connection without consent) does nothing.
    if (
      connection === null ||
      connection.status !== 'active' ||
      connection.encryptedConsent === null
    ) {
      return;
    }

    // Read the watermark before start(): start() inserts this run, which must not shadow it.
    const sinceDt = since ? new Date(since) : await this.getDefaultSince(connectionId);
    const syncRunId = await this.syncRunRepo.start(connectionId, runOptions);
    let totalFetched = 0;

    try {
      const connector = this.connectorRegistry.resolve(connection.provider);
      const accounts = await connector.listAccounts(connectionId, connection.encryptedConsent);

      await this.bankAccountRepo.upsertAll(accounts, connectionId, connection.userId, scope);

      const dbAccounts = await this.bankAccountRepo.listByConnection(connectionId, scope);

      for (const rawAccount of accounts) {
        const dbAccount = dbAccounts.find((a) => a.externalId === rawAccount.externalId);
        if (dbAccount === undefined) {
          continue;
        }

        // Scheduled sync: nobody is present, so no PSU context (SYNC-003 adds attended runs).
        const rawTxs = await connector.fetchTransactions({
          account: { externalId: rawAccount.externalId },
          consent: connection.encryptedConsent,
          dateFrom: sinceDt,
          strategy: 'default',
          psu: null,
        });

        await this.ingestUseCase.execute({
          accountId: dbAccount.id,
          rawTransactions: rawTxs,
          householdId,
          ownerUserId: connection.userId,
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

  private runOptions(payload: BankSyncJobPayload): SyncRunStartOptions {
    if (payload.trigger !== undefined && payload.attended !== undefined) {
      return { trigger: payload.trigger, attended: payload.attended };
    }
    if (!this.legacyPayloadLogged) {
      this.legacyPayloadLogged = true;
      this.logger.warn('Sync job without trigger/attended (queued before BNK-003): scheduled');
    }

    return { trigger: 'scheduled', attended: false };
  }

  private async getDefaultSince(connectionId: BankConnectionId): Promise<Date> {
    const lastSuccess = await this.syncRunRepo.lastSuccessfulAt(connectionId);
    const dayMs = 24 * 3600 * 1000;
    if (lastSuccess !== null) {
      return new Date(lastSuccess.getTime() - BankSyncProcessor.OVERLAP_DAYS * dayMs);
    }

    return new Date(Date.now() - BankSyncProcessor.INITIAL_LOOKBACK_DAYS * dayMs);
  }

  private checkExpiryReminder(connection: { expiresAt: Date | null }): void {
    if (connection.expiresAt === null) {
      return;
    }
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(
      sevenDaysFromNow.getDate() + BankSyncProcessor.RECONNECT_REMINDER_DAYS,
    );
    if (connection.expiresAt < sevenDaysFromNow) {
      // In production: enqueue reconnect-reminder notification via outbox
    }
  }
}
