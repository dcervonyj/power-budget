import 'reflect-metadata';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { uuidv7 } from 'uuidv7';
import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import { getDb, resetState, startContainers, stopContainers } from './setup.js';
import { insertTestHousehold, insertTestUser } from './test-helpers.js';
import * as schema from '../../../drizzle/schema.js';
import type {
  BankAccountRepository,
  BankConnectionRepository,
  BankConnector,
  BankConnectorRegistry,
} from '../../domain/bank/ports.js';
import type { BankConnection } from '../../domain/bank/entities.js';
import type { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import {
  BankSyncProcessor,
  type BankSyncJobPayload,
} from '../../infrastructure/bank/BankSyncProcessor.js';
import { BullMQBankSyncQueue } from '../../infrastructure/bank/BullMQBankSyncQueue.js';
import { DrizzleSyncRunRepository } from '../../infrastructure/bank/DrizzleSyncRunRepository.js';
import {
  DEFAULT_JOB_OPTIONS,
  bullmqBackoffStrategy,
} from '../../infrastructure/queue/retry-config.js';

const QUEUE_NAME = 'cln-037-bank-sync';
const DAY_MS = 24 * 3600 * 1000;

describe('bank sync watermark and retry against real Postgres + Redis (CLN-037)', () => {
  let redisUrl: string;
  let connectionId: BankConnectionId;
  let householdId: HouseholdId;
  let connector: ReturnType<typeof mock<BankConnector>>;
  let processor: BankSyncProcessor;
  let syncRunRepo: DrizzleSyncRunRepository;

  beforeAll(async () => {
    ({ redisUrl } = await startContainers());
  });

  afterAll(async () => {
    await stopContainers();
  });

  beforeEach(async () => {
    await resetState();
    const user = await insertTestUser(getDb());
    const household = await insertTestHousehold(getDb());
    householdId = household.id as HouseholdId;
    connectionId = uuidv7() as BankConnectionId;
    await getDb().insert(schema.bankConnections).values({
      id: connectionId,
      householdId: household.id,
      userId: user.id,
      provider: 'in_memory',
      bankId: 'test-bank',
      encryptedConsent: 'enc-token',
      status: 'active',
    });

    const connectionRepo = mock<BankConnectionRepository>();
    const connection: BankConnection = {
      id: connectionId,
      householdId,
      userId: user.id as UserId,
      provider: 'in_memory' as never,
      bankId: 'test-bank',
      externalConsentRef: null,
      encryptedConsent: 'enc-token' as never,
      expiresAt: null,
      status: 'active',
      disconnectedAt: null,
      createdAt: new Date(),
    };
    connectionRepo.findById.mockResolvedValue(connection);
    const bankAccountRepo = mock<BankAccountRepository>();
    bankAccountRepo.listByConnection.mockResolvedValue([
      { id: 'acc-1', externalId: 'ext-1' } as never,
    ]);
    connector = mock<BankConnector>();
    connector.listAccounts.mockResolvedValue([{ externalId: 'ext-1' } as never]);
    connector.fetchTransactions.mockResolvedValue([]);
    const registry = mock<BankConnectorRegistry>();
    registry.resolve.mockReturnValue(connector);
    syncRunRepo = new DrizzleSyncRunRepository(getDb());
    processor = new BankSyncProcessor(
      connectionRepo,
      bankAccountRepo,
      syncRunRepo,
      registry,
      mock<IngestBankTransactionsUseCase>(),
    );
  });

  function job(data: Partial<BankSyncJobPayload> = {}): Job<BankSyncJobPayload> {
    const payload: BankSyncJobPayload = {
      connectionId,
      householdId,
      trigger: 'scheduled',
      attended: false,
      ...data,
    };

    return { data: payload } as Job<BankSyncJobPayload>;
  }

  function lastDateFrom(): Date {
    const call = connector.fetchTransactions.mock.calls.at(-1);
    if (call === undefined) {
      throw new Error('fetchTransactions was not called');
    }

    return call[0].dateFrom;
  }

  it('first sync looks 90 days back, later syncs resume from the last success minus the overlap', async () => {
    const before = Date.now();
    await processor.process(job());
    expect(Math.abs(lastDateFrom().getTime() - (before - 90 * DAY_MS))).toBeLessThan(60_000);

    const lastSuccess = await syncRunRepo.lastSuccessfulAt(connectionId);
    expect(lastSuccess).not.toBeNull();

    await processor.process(job());
    expect(lastDateFrom().getTime()).toBe(
      (lastSuccess as Date).getTime() - BankSyncProcessor.OVERLAP_DAYS * DAY_MS,
    );
  });

  it('a failed run does not move the watermark', async () => {
    await processor.process(job());
    const lastSuccess = await syncRunRepo.lastSuccessfulAt(connectionId);
    connector.listAccounts.mockRejectedValueOnce(new Error('bank down'));
    await expect(processor.process(job())).rejects.toThrow('bank down');

    expect(await syncRunRepo.lastSuccessfulAt(connectionId)).toEqual(lastSuccess);
    await processor.process(job());
    expect(lastDateFrom().getTime()).toBe(
      (lastSuccess as Date).getTime() - BankSyncProcessor.OVERLAP_DAYS * DAY_MS,
    );
  });

  describe('BullMQ', () => {
    let queue: Queue<BankSyncJobPayload>;
    let worker: Worker<BankSyncJobPayload> | null;

    beforeEach(() => {
      queue = new Queue(QUEUE_NAME, { connection: { url: redisUrl } });
      worker = null;
    });

    afterEach(async () => {
      await worker?.close();
      await queue.obliterate({ force: true });
      await queue.close();
    });

    it('a failing sync job is delayed by the backoff, not retried at once', async () => {
      connector.listAccounts.mockRejectedValue(new Error('bank down'));
      worker = new Worker<BankSyncJobPayload>(QUEUE_NAME, (j) => processor.process(j), {
        connection: { url: redisUrl },
        settings: { backoffStrategy: bullmqBackoffStrategy },
      });
      const { jobId } = await new BullMQBankSyncQueue(queue).enqueue({
        connectionId,
        householdId,
        trigger: 'manual',
        attended: true,
      });

      const deadline = Date.now() + 15_000;
      while ((await queue.getJobCounts('delayed')).delayed === 0) {
        if (Date.now() > deadline) {
          throw new Error('job never reached delayed');
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const delayed = await queue.getJob(jobId);
      expect(await delayed?.getState()).toBe('delayed');
      expect(delayed?.attemptsMade).toBe(1);
      expect(delayed?.delay).toBe(30_000);
      expect(delayed?.opts.removeOnFail).toEqual(DEFAULT_JOB_OPTIONS.removeOnFail);
      // Exactly one attempt ran: the retry is waiting, not hammering the bank.
      expect(connector.listAccounts).toHaveBeenCalledTimes(1);
    });
  });
});
