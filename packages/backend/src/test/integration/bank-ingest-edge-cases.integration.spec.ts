import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BankAccountId, HouseholdId, IsoDate, TransactionId, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { SuggestFromMerchantRulesUseCase } from '../../application/categorisation/SuggestFromMerchantRulesUseCase.js';
import { DrizzleMerchantRuleRepository } from '../../infrastructure/categorisation/DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from '../../infrastructure/categorisation/DrizzlePlannedItemResolver.js';
import { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import type { RawTransaction } from '../../domain/bank/entities.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { DrizzlePlanActivityReader } from '../../infrastructure/plans/DrizzlePlanActivityReader.js';
import { DrizzleMappingRepository } from '../../infrastructure/transactions/DrizzleMappingRepository.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

/**
 * CLN-039 (audit BE-BUGS-07, BE-BUGS-10): bank rows in an unsupported currency are stored
 * ignored and never break the dashboard reads; identical rows of one fetch are all kept.
 */
let fixtures: Pool;
let appPool: Pool;
let db: NodePgDatabase<typeof schema>;
let householdId: HouseholdId;
let userId: UserId;
let accountId: BankAccountId;
let useCase: IngestBankTransactionsUseCase;
let statements: string[];

function raw(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    accountExternalId: 'ext-1',
    status: 'booked',
    entryReference: null,
    bookingDate: IsoDate.of('2026-10-12'),
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

function inScope<T>(fn: () => Promise<T>): Promise<T> {
  return runInDbScope({ kind: 'household', householdId, userId }, fn);
}

function ingest(rows: readonly RawTransaction[]): Promise<void> {
  return inScope(() =>
    useCase.execute({ accountId, rawTransactions: rows, householdId, ownerUserId: userId }),
  );
}

async function storedRows(): Promise<{ currency: string; ignored: boolean; ext: string }[]> {
  const res = await fixtures.query(
    'SELECT currency, ignored, external_id AS ext FROM transactions WHERE household_id = $1 ORDER BY external_id',
    [householdId],
  );

  return res.rows;
}

describe('Integration: bank ingest edge cases (CLN-039)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    db = drizzle(appPool, { schema });
    const countingDb = drizzle(appPool, {
      schema,
      logger: { logQuery: (query: string) => statements.push(query) },
    });
    useCase = new IngestBankTransactionsUseCase(
      new DrizzleTransactionRepository(countingDb),
      uuidv7,
      new SuggestFromMerchantRulesUseCase(
        new DrizzleMerchantRuleRepository(db),
        new DrizzlePlannedItemResolver(db),
      ),
    );
  });

  beforeEach(async () => {
    statements = [];
    await resetState();
    householdId = HouseholdId.of(uuidv7());
    userId = UserId.of(uuidv7());
    accountId = BankAccountId.of(uuidv7());
    const connectionId = uuidv7();
    await fixtures.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
      userId,
      `cln039-${userId}@example.com`,
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
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
       VALUES ($1, $2, $3, 'enable_banking', 'PKO')`,
      [connectionId, householdId, userId],
    );
    await fixtures.query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
       VALUES ($1, $2, $3, $4, 'ext-1', 'Main', 'PLN')`,
      [accountId, householdId, userId, connectionId],
    );
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  it('stores an unsupported-currency row as ignored and the plan reader skips it', async () => {
    await ingest([raw({ currency: 'HUF', remittance: 'Wise pocket' }), raw()]);

    const rows = await storedRows();
    const plan = await inScope(() =>
      new DrizzlePlanActivityReader(db).read({
        householdId,
        period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
      }),
    );

    expect(rows.map((row) => [row.currency.trim(), row.ignored])).toEqual(
      expect.arrayContaining([
        ['HUF', true],
        ['PLN', false],
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(plan.transactions.map((tx) => tx.amount.currency)).toEqual(['PLN']);
  });

  it('keeps two identical rows of one fetch, and a re-ingest adds nothing', async () => {
    await ingest([raw(), raw(), raw({ remittance: 'Other' })]);
    const first = await storedRows();

    await ingest([raw(), raw(), raw({ remittance: 'Other' })]);
    const second = await storedRows();

    expect(first).toHaveLength(3);
    expect(second).toEqual(first);
  });

  it('writes an account batch with one INSERT and a re-run with one that adds nothing (CLN-054)', async () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      raw({ entryReference: `ref-${i % 30}`, remittance: `Row ${i}` }),
    );

    await ingest(rows);
    const insertsAfterFirst = statements.filter((sql) => /^\s*insert into/i.test(sql));
    const first = await storedRows();
    await ingest(rows);
    const insertsAfterRerun = statements.filter((sql) => /^\s*insert into/i.test(sql));
    const second = await storedRows();

    expect(insertsAfterFirst).toHaveLength(1);
    expect(statements.filter((sql) => /^\s*select/i.test(sql))).toHaveLength(0);
    expect(first).toHaveLength(30);
    expect(insertsAfterRerun).toHaveLength(2);
    expect(second).toEqual(first);
  });

  it('writes a batch over 500 rows with exactly one INSERT (CLN-054)', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) =>
      raw({ entryReference: `big-${i}`, remittance: `Row ${i}`, amountMinor: BigInt(-i - 1) }),
    );

    await ingest(rows);

    expect(statements.filter((sql) => /^\s*insert into/i.test(sql))).toHaveLength(1);
    expect(await storedRows()).toHaveLength(1200);
  });

  describe('readers leave an unsupported-currency row out instead of throwing', () => {
    async function seedHufRow(status: string): Promise<string> {
      const id = uuidv7();
      await fixtures.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, status, ignored)
         VALUES ($1, $2, $3, '2026-10-12', -5000, 'HUF', 'Wise pocket', $4, true)`,
        [id, householdId, accountId, status],
      );

      return id;
    }

    it.each([
      [
        'findById',
        (repo: DrizzleTransactionRepository, id: string) =>
          repo.findById(TransactionId.of(id), { householdId }),
      ],
      [
        'findOwnedById',
        (repo: DrizzleTransactionRepository, id: string) =>
          repo.findOwnedById(TransactionId.of(id), userId, { householdId }),
      ],
    ])('%s answers null', async (_name, read) => {
      const id = await seedHufRow('booked');

      expect(await inScope(() => read(new DrizzleTransactionRepository(db), id))).toBeNull();
    });

    it('list and listProvisional skip the row and still return the supported ones', async () => {
      await seedHufRow('booked');
      await seedHufRow('live');
      await ingest([raw()]);
      const repo = new DrizzleTransactionRepository(db);

      const page = await inScope(() =>
        repo.list({ householdId, ownerUserId: userId, limit: 50 }, { householdId }),
      );
      const provisional = await inScope(() =>
        repo.listProvisional(
          {
            accountId,
            window: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
          },
          { householdId },
        ),
      );

      expect(page.items.map((item) => item.transaction.amount.currency)).toEqual(['PLN']);
      expect(provisional).toEqual([]);
    });

    it('mapping the row to a plan item answers not found', async () => {
      const id = await seedHufRow('booked');

      await expect(
        inScope(() =>
          new DrizzleMappingRepository(db).set(TransactionId.of(id), null, userId, { householdId }),
        ),
      ).rejects.toThrow();
    });
  });
});
