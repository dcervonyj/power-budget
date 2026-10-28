import 'reflect-metadata';
import { makeBankSyncJob } from '../doubles/bankSyncJob.js';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BankConnectionId, HouseholdId, IsoDate, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { SuggestFromPlannedHintsUseCase } from '../../application/categorisation/SuggestFromPlannedHintsUseCase.js';
import { DrizzlePlannedHintReader } from '../../infrastructure/categorisation/DrizzlePlannedHintReader.js';
import { SuggestFromMerchantRulesUseCase } from '../../application/categorisation/SuggestFromMerchantRulesUseCase.js';
import { DrizzleMerchantRuleRepository } from '../../infrastructure/categorisation/DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from '../../infrastructure/categorisation/DrizzlePlannedItemResolver.js';
import { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import type { RawBankAccount, RawTransaction } from '../../domain/bank/entities.js';
import type { FetchTransactionsInput } from '../../domain/bank/ports.js';
import {
  BankSyncProcessor,
  type BankSyncJobPayload,
} from '../../infrastructure/bank/BankSyncProcessor.js';
import { DrizzleBankAccountRepository } from '../../infrastructure/bank/DrizzleBankAccountRepository.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import { DrizzleSyncRunRepository } from '../../infrastructure/bank/DrizzleSyncRunRepository.js';
import { InMemoryBankConnector } from '../../infrastructure/bank/InMemoryBankConnector.js';
import { InMemoryBankConnectorRegistry } from '../../infrastructure/bank/InMemoryBankConnectorRegistry.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

/**
 * CLN-055 (audit ARCH-08): characterisation test of the bank sync pipeline on real Postgres.
 * The real BankSyncProcessor runs the job against the Drizzle repositories and the real ingest
 * use case, with InMemoryBankConnector as the bank. Asserts what lands in `transactions`,
 * dedupe, re-run idempotency and the `sync_runs` row, so BNK-005/006 and SYNC-004/006 can
 * refactor with a behavioural safety net.
 */
const DAY_MS = 24 * 3600 * 1000;
const PROVIDER = 'enable_banking';
const ACCOUNT_EXTERNAL_ID = 'ext-1';

/** Records every fetch the processor makes, so the watermark can be asserted exactly. */
class RecordingConnector extends InMemoryBankConnector {
  readonly fetches: FetchTransactionsInput[] = [];
  listAccountsError: Error | null = null;

  override async listAccounts(): Promise<RawBankAccount[]> {
    if (this.listAccountsError !== null) {
      throw this.listAccountsError;
    }

    return super.listAccounts();
  }

  override async fetchTransactions(input: FetchTransactionsInput): Promise<RawTransaction[]> {
    this.fetches.push(input);

    return super.fetchTransactions(input);
  }
}

interface SyncRunRow {
  readonly status: string;
  readonly trigger: string;
  readonly attended: boolean;
  readonly fetched: number;
  readonly error_message: string | null;
  readonly last_successful_at: Date | null;
}

interface TransactionRow {
  readonly id: string;
  readonly external_id: string;
  readonly occurred_on: string;
  readonly amount_minor: string;
  readonly description: string;
  readonly status: string;
  readonly source: string;
}

let fixtures: Pool;
let appPool: Pool;
let db: NodePgDatabase<typeof schema>;
let householdId: HouseholdId;
let userId: UserId;
let connectionId: BankConnectionId;
let connector: RecordingConnector;
let processor: BankSyncProcessor;
const START = new Date();
let now = START;
let plannedItemId: string;

function daysAgo(days: number): IsoDate {
  return IsoDate.of(new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10));
}

function raw(overrides: Partial<RawTransaction>): RawTransaction {
  return {
    accountExternalId: ACCOUNT_EXTERNAL_ID,
    status: 'booked',
    entryReference: null,
    bookingDate: daysAgo(2),
    valueDate: null,
    transactionDate: null,
    amountMinor: -450n,
    currency: 'PLN',
    direction: 'debit',
    originalAmount: null,
    counterpartyName: 'Cafe',
    counterpartyIban: null,
    remittance: 'Coffee',
    mcc: null,
    bankTxCode: null,
    balanceAfter: null,
    ...overrides,
  };
}

const SALARY = raw({
  entryReference: 'ENTRY-SALARY',
  bookingDate: daysAgo(10),
  amountMinor: 500000n,
  direction: 'credit',
  counterpartyName: 'Employer',
  remittance: 'Salary',
});
const GROCERIES = raw({
  entryReference: 'ENTRY-GROCERIES',
  bookingDate: daysAgo(5),
  amountMinor: -12345n,
  counterpartyName: 'Shop',
  remittance: 'Groceries',
});
const COFFEE = raw({ bookingDate: daysAgo(2) });
const PENDING = raw({
  status: 'pending',
  bookingDate: daysAgo(1),
  amountMinor: -999n,
  remittance: 'Card hold',
});
/** Older than the 90-day first-sync lookback: the connector filters it out. */
const ANCIENT = raw({
  entryReference: 'ENTRY-ANCIENT',
  bookingDate: daysAgo(120),
  amountMinor: -100n,
  remittance: 'Ancient',
});

function script(transactions: readonly RawTransaction[]): void {
  connector.scriptAccount({
    account: {
      externalId: ACCOUNT_EXTERNAL_ID,
      name: 'Main',
      iban: null,
      currency: 'PLN',
      balanceMinor: 100000n,
    },
    snapshots: [{ from: new Date(0), transactions }],
    balances: [],
  });
}

function runJob(since?: string): Promise<void> {
  const payload: BankSyncJobPayload = {
    connectionId,
    householdId,
    trigger: 'scheduled',
    attended: false,
    ...(since === undefined ? {} : { since }),
  };

  return runInDbScope({ kind: 'household', householdId, userId }, () =>
    processor.process(makeBankSyncJob(payload)),
  );
}

async function transactionRows(): Promise<TransactionRow[]> {
  const res = await fixtures.query<TransactionRow>(
    `SELECT id, external_id, occurred_on::text AS occurred_on, amount_minor::text AS amount_minor,
            description, status, source
       FROM transactions WHERE household_id = $1 ORDER BY occurred_on, amount_minor`,
    [householdId],
  );

  return res.rows;
}

async function syncRuns(): Promise<SyncRunRow[]> {
  const res = await fixtures.query<SyncRunRow>(
    `SELECT status, trigger, attended, fetched, error_message, last_successful_at
       FROM sync_runs WHERE connection_id = $1 ORDER BY created_at`,
    [connectionId],
  );

  return res.rows;
}

async function mappings(): Promise<{ transaction_id: string; planned_item_id: string }[]> {
  const res = await fixtures.query<{ transaction_id: string; planned_item_id: string }>(
    `SELECT transaction_id, planned_item_id FROM transaction_mappings WHERE household_id = $1`,
    [householdId],
  );

  return res.rows;
}

describe('Integration: bank sync pipeline, processor to transactions (CLN-055)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    db = drizzle(appPool, { schema });
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  beforeEach(async () => {
    await resetState();
    now = START;
    householdId = HouseholdId.of(uuidv7());
    userId = UserId.of(uuidv7());
    connectionId = BankConnectionId.of(uuidv7());
    plannedItemId = uuidv7();
    const planId = uuidv7();
    await fixtures.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
      userId,
      `cln055-${userId}@example.com`,
    ]);
    await fixtures.query(
      `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
      [householdId],
    );
    await fixtures.query(
      `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [householdId, userId],
    );
    await fixtures.query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, encrypted_consent, status)
       VALUES ($1, $2, $3, $4, 'PKO', 'enc-consent', 'active')`,
      [connectionId, householdId, userId, PROVIDER],
    );
    await fixtures.query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
       VALUES ($1, $2, $3, 'P', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
      [planId, householdId, userId],
    );
    await fixtures.query(
      `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
       VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
      [plannedItemId, planId, householdId, uuidv7()],
    );

    connector = new RecordingConnector(PROVIDER, { now: () => now });
    const registry = new InMemoryBankConnectorRegistry();
    registry.register(connector);
    processor = new BankSyncProcessor(
      new DrizzleBankConnectionRepository(db),
      new DrizzleBankAccountRepository(db),
      new DrizzleSyncRunRepository(db),
      registry,
      new IngestBankTransactionsUseCase(
        new DrizzleTransactionRepository(db),
        uuidv7,
        new SuggestFromMerchantRulesUseCase(
          new DrizzleMerchantRuleRepository(db),
          new DrizzlePlannedItemResolver(db),
        ),
        new SuggestFromPlannedHintsUseCase(new DrizzlePlannedHintReader(db)),
      ),
    );
  });

  it('first sync stores the booked rows, skips pending and ancient ones, and records the run', async () => {
    script([SALARY, GROCERIES, COFFEE, PENDING, ANCIENT]);
    const before = Date.now();

    await runJob();

    const after = Date.now();
    expect(
      (await transactionRows()).map((r) => [
        r.external_id === 'ENTRY-SALARY' || r.external_id === 'ENTRY-GROCERIES',
        r.occurred_on,
        r.amount_minor,
        r.description,
        r.status,
        r.source,
      ]),
    ).toEqual([
      [true, daysAgo(10), '500000', 'Salary', 'booked', 'bank_sync'],
      [true, daysAgo(5), '-12345', 'Groceries', 'booked', 'bank_sync'],
      [false, daysAgo(2), '-450', 'Coffee', 'booked', 'bank_sync'],
    ]);
    const runs = await syncRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: 'success',
      trigger: 'scheduled',
      attended: false,
      // Connector rows of the run: the pending one is fetched and then skipped by ingest.
      fetched: 4,
      error_message: null,
    });
    const finishedAt = runs[0]!.last_successful_at!.getTime();
    expect(finishedAt).toBeGreaterThanOrEqual(before);
    expect(finishedAt).toBeLessThanOrEqual(after);
    expect(
      await fixtures
        .query(`SELECT external_id, name, currency FROM bank_accounts WHERE connection_id = $1`, [
          connectionId,
        ])
        .then((r) => r.rows),
    ).toEqual([{ external_id: ACCOUNT_EXTERNAL_ID, name: 'Main', currency: 'PLN' }]);
  });

  it('first sync looks back 90 days from now', async () => {
    script([SALARY]);

    await runJob();

    expect(connector.fetches).toHaveLength(1);
    const dateFrom = connector.fetches[0]!.dateFrom.getTime();
    expect(Math.abs(dateFrom - (Date.now() - 90 * DAY_MS))).toBeLessThan(60_000);
  });

  it('keeps identical rows of one fetch apart and still dedupes them on re-run', async () => {
    script([COFFEE, COFFEE, COFFEE]);

    await runJob();
    await runJob(daysAgo(90));

    const rows = await transactionRows();
    expect(rows.map((r) => [r.description, r.amount_minor])).toEqual([
      ['Coffee', '-450'],
      ['Coffee', '-450'],
      ['Coffee', '-450'],
    ]);
    expect(new Set(rows.map((r) => r.external_id)).size).toBe(3);
  });

  it('re-running the same job adds no rows, keeps ids and mappings, and writes a second run', async () => {
    script([SALARY, GROCERIES, COFFEE]);
    await runJob();
    const first = await transactionRows();
    const groceries = first.find((r) => r.description === 'Groceries')!;
    await fixtures.query(
      `INSERT INTO transaction_mappings (transaction_id, household_id, planned_item_id, amount_minor, currency, mapped_by)
       VALUES ($1, $2, $3, -12345, 'PLN', $4)`,
      [groceries.id, householdId, plannedItemId, userId],
    );

    await runJob(daysAgo(90));

    expect(connector.fetches[1]!.dateFrom).toEqual(new Date(`${daysAgo(90)}T00:00:00.000Z`));
    expect(await transactionRows()).toEqual(first);
    expect(await mappings()).toEqual([
      { transaction_id: groceries.id, planned_item_id: plannedItemId },
    ]);
    const runs = await syncRuns();
    expect(runs.map((r) => [r.status, r.fetched, r.error_message])).toEqual([
      ['success', 3, null],
      ['success', 3, null],
    ]);
  });

  it('second sync starts 3 days before the last successful run and picks up a late booking', async () => {
    script([SALARY, COFFEE]);
    await runJob();
    const lastSuccessfulAt = (await syncRuns())[0]!.last_successful_at!;
    now = new Date(now.getTime() + DAY_MS);
    const lateBooked = raw({
      entryReference: 'ENTRY-LATE',
      bookingDate: daysAgo(1),
      amountMinor: -777n,
      remittance: 'Late booked',
    });
    script([SALARY, COFFEE, lateBooked]);

    await runJob();

    expect(connector.fetches[1]!.dateFrom).toEqual(
      new Date(lastSuccessfulAt.getTime() - 3 * DAY_MS),
    );
    expect((await transactionRows()).map((r) => [r.description, r.amount_minor])).toEqual([
      ['Salary', '500000'],
      ['Coffee', '-450'],
      ['Late booked', '-777'],
    ]);
    expect((await syncRuns()).map((r) => [r.status, r.fetched])).toEqual([
      ['success', 2],
      // Salary is older than the overlap window, so only the coffee and the new row come back.
      ['success', 2],
    ]);
  });

  it('a failed run is recorded as failed, stores nothing and leaves no watermark', async () => {
    script([SALARY]);
    connector.listAccountsError = new Error('bank unreachable');

    await expect(runJob()).rejects.toThrow('bank unreachable');

    expect(await transactionRows()).toEqual([]);
    expect(await syncRuns()).toEqual([
      {
        status: 'failed',
        trigger: 'scheduled',
        attended: false,
        fetched: 0,
        error_message: 'bank unreachable',
        last_successful_at: null,
      },
    ]);
  });

  it('a job for a disconnected connection does nothing', async () => {
    script([SALARY]);
    await fixtures.query(`UPDATE bank_connections SET status = 'disconnected' WHERE id = $1`, [
      connectionId,
    ]);

    await runJob();

    expect(await transactionRows()).toEqual([]);
    expect(await syncRuns()).toEqual([]);
  });
});
