import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  PlannedItemId,
  PlanId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { DrizzleMappingRepository } from '../../infrastructure/transactions/DrizzleMappingRepository.js';
import { DrizzleTransferRepository } from '../../infrastructure/transactions/DrizzleTransferRepository.js';
import { DrizzleMerchantRuleRepository } from '../../infrastructure/categorisation/DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from '../../infrastructure/categorisation/DrizzlePlannedItemResolver.js';
import { LearnMerchantRuleUseCase } from '../../application/categorisation/LearnMerchantRuleUseCase.js';
import { SuggestFromPlannedHintsUseCase } from '../../application/categorisation/SuggestFromPlannedHintsUseCase.js';
import { DrizzlePlannedHintReader } from '../../infrastructure/categorisation/DrizzlePlannedHintReader.js';
import { SuggestFromMerchantRulesUseCase } from '../../application/categorisation/SuggestFromMerchantRulesUseCase.js';
import { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { MapTransactionUseCase } from '../../application/transactions/use-cases/MapTransactionUseCase.js';
import type { RawTransaction } from '../../domain/bank/entities.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

/**
 * AI-003: a correction in October teaches the rule, a November row is suggested into
 * November's planned item, and the latest correction wins. Real Postgres, app role, RLS.
 */
interface Fixture {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly accountId: BankAccountId;
  readonly groceries: CategoryId;
  readonly dining: CategoryId;
  readonly octGroceries: PlannedItemId;
  readonly novGroceries: PlannedItemId;
  readonly octDining: PlannedItemId;
  readonly novDining: PlannedItemId;
}

let fixtures: Pool;
let appPool: Pool;
let F: Fixture;
let ingest: IngestBankTransactionsUseCase;
let mapUseCase: MapTransactionUseCase;
let txRepo: DrizzleTransactionRepository;

function asHousehold<T>(fn: () => Promise<T>): Promise<T> {
  return runInDbScope({ kind: 'household', householdId: F.householdId, userId: F.userId }, fn);
}

async function seed(): Promise<Fixture> {
  const f: Fixture = {
    householdId: HouseholdId.of(uuidv7()),
    userId: UserId.of(uuidv7()),
    accountId: BankAccountId.of(uuidv7()),
    groceries: CategoryId.of(uuidv7()),
    dining: CategoryId.of(uuidv7()),
    octGroceries: PlannedItemId.of(uuidv7()),
    novGroceries: PlannedItemId.of(uuidv7()),
    octDining: PlannedItemId.of(uuidv7()),
    novDining: PlannedItemId.of(uuidv7()),
  };
  const connectionId = uuidv7();
  const q = fixtures;
  await q.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
    f.userId,
    `ai003-${f.userId}@example.com`,
  ]);
  await q.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`, [
    f.householdId,
  ]);
  await q.query(
    `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [f.householdId, f.userId],
  );
  await q.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
     VALUES ($1, $2, $3, 'enable_banking', 'PKO')`,
    [connectionId, f.householdId, f.userId],
  );
  await q.query(
    `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
     VALUES ($1, $2, $3, $4, 'ext-1', 'Main', 'PLN')`,
    [f.accountId, f.householdId, f.userId, connectionId],
  );
  for (const [id, name] of [
    [f.groceries, 'Groceries'],
    [f.dining, 'Dining'],
  ]) {
    await q.query(`INSERT INTO categories (id, household_id, name) VALUES ($1, $2, $3)`, [
      id,
      f.householdId,
      name,
    ]);
  }
  const months: readonly [string, string, string, PlannedItemId, PlannedItemId][] = [
    ['October', '2026-10-01', '2026-10-31', f.octGroceries, f.octDining],
    ['November', '2026-11-01', '2026-11-30', f.novGroceries, f.novDining],
  ];
  for (const [name, start, end, groceriesItem, diningItem] of months) {
    const planId = PlanId.of(uuidv7());
    await q.query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
       VALUES ($1, $2, $3, $4, 'household', 'monthly', $5, $6, 'PLN')`,
      [planId, f.householdId, f.userId, name, start, end],
    );
    for (const [itemId, categoryId] of [
      [groceriesItem, f.groceries],
      [diningItem, f.dining],
    ]) {
      await q.query(
        `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
         VALUES ($1, $2, $3, $4, 'expense', 50000, 'PLN')`,
        [itemId, planId, f.householdId, categoryId],
      );
    }
  }

  return f;
}

function biedronka(date: string, reference: string): RawTransaction {
  return {
    accountExternalId: 'ext-1',
    status: 'booked',
    entryReference: reference,
    bookingDate: IsoDate.of(date),
    valueDate: null,
    transactionDate: null,
    amountMinor: -4500n,
    currency: 'PLN',
    direction: 'debit',
    originalAmount: null,
    counterpartyName: 'Biedronka',
    counterpartyIban: null,
    remittance: 'Card payment to Biedronka ****1234',
    mcc: null,
    bankTxCode: null,
    balanceAfter: null,
  };
}

async function ingestRow(date: string, reference: string): Promise<TransactionId> {
  await asHousehold(() =>
    ingest.execute({
      accountId: F.accountId,
      rawTransactions: [biedronka(date, reference)],
      householdId: F.householdId,
      ownerUserId: F.userId,
    }),
  );
  const { rows } = await fixtures.query<{ id: string }>(
    `SELECT id FROM transactions WHERE external_id = $1 AND household_id = $2`,
    [reference, F.householdId],
  );

  return TransactionId.of(rows[0]!.id);
}

async function map(id: TransactionId, plannedItemId: PlannedItemId): Promise<void> {
  await asHousehold(() =>
    mapUseCase.execute({
      transactionId: id,
      plannedItemId,
      by: F.userId,
      householdId: F.householdId,
      planId: PlanId.of(uuidv7()),
    }),
  );
}

async function suggestionOf(id: TransactionId): Promise<Record<string, unknown>> {
  const { rows } = await fixtures.query(
    `SELECT suggested_planned_item_id, suggested_category_id, suggestion_source, auto_mapped
     FROM transactions WHERE id = $1`,
    [id],
  );

  return rows[0] as Record<string, unknown>;
}

async function ruleOf(): Promise<{ category_id: string; hits: number; plan_kind_pref: string }> {
  const { rows } = await fixtures.query(
    `SELECT category_id, hits, plan_kind_pref FROM merchant_rules WHERE household_id = $1`,
    [F.householdId],
  );
  expect(rows).toHaveLength(1);

  return rows[0] as { category_id: string; hits: number; plan_kind_pref: string };
}

describe('Integration: merchant memory (AI-003)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    const db = drizzle(appPool, { schema });
    txRepo = new DrizzleTransactionRepository(db);
    const rules = new DrizzleMerchantRuleRepository(db);
    const items = new DrizzlePlannedItemResolver(db);
    ingest = new IngestBankTransactionsUseCase(
      txRepo,
      uuidv7,
      new SuggestFromMerchantRulesUseCase(rules, items),
      new SuggestFromPlannedHintsUseCase(new DrizzlePlannedHintReader(db)),
    );
    mapUseCase = new MapTransactionUseCase(
      txRepo,
      new DrizzleMappingRepository(db),
      new DrizzleTransferRepository(db),
      new LearnMerchantRuleUseCase(
        rules,
        items,
        () => new Date(),
        () => undefined,
      ),
    );
  });

  beforeEach(async () => {
    await resetState();
    F = await seed();
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  it('suggests a November Biedronka row into November Groceries after one October mapping', async () => {
    const october = await ingestRow('2026-10-05', 'oct-1');
    expect(await suggestionOf(october)).toMatchObject({ suggested_planned_item_id: null });

    await map(october, F.octGroceries);
    const november = await ingestRow('2026-11-03', 'nov-1');

    expect(await suggestionOf(november)).toEqual({
      suggested_planned_item_id: F.novGroceries,
      suggested_category_id: F.groceries,
      suggestion_source: 'merchant_rule',
      auto_mapped: false,
    });
    expect(await ruleOf()).toMatchObject({
      category_id: F.groceries,
      hits: 1,
      plan_kind_pref: 'household',
    });
  });

  it('suggests only the category when the transaction date has no plan', async () => {
    await map(await ingestRow('2026-10-05', 'oct-1'), F.octGroceries);

    const december = await ingestRow('2026-12-03', 'dec-1');

    expect(await suggestionOf(december)).toMatchObject({
      suggested_planned_item_id: null,
      suggested_category_id: F.groceries,
    });
  });

  it('lets the most recent correction win, counting repeats and restarting on a changed category', async () => {
    const first = await ingestRow('2026-10-05', 'oct-1');
    await map(first, F.octGroceries);
    await map(first, F.octGroceries);
    expect(await ruleOf()).toMatchObject({ category_id: F.groceries, hits: 2 });

    const second = await ingestRow('2026-10-09', 'oct-2');
    await map(second, F.octDining);

    expect(await ruleOf()).toMatchObject({ category_id: F.dining, hits: 1 });
    const november = await ingestRow('2026-11-03', 'nov-1');
    expect(await suggestionOf(november)).toMatchObject({
      suggested_planned_item_id: F.novDining,
      suggested_category_id: F.dining,
    });
  });

  it('suggests from a unique planned item hint before merchant memory and flags it auto-mapped (AI-004)', async () => {
    await fixtures.query(`UPDATE planned_items SET match_hint = $2::jsonb WHERE id = $1`, [
      F.octGroceries,
      JSON.stringify({
        counterpartyPattern: 'biedronka',
        amountMinor: '4500',
        toleranceMinor: '0',
      }),
    ]);
    await map(await ingestRow('2026-10-02', 'oct-0'), F.octDining);

    const october = await ingestRow('2026-10-05', 'oct-1');

    expect(await suggestionOf(october)).toEqual({
      suggested_planned_item_id: F.octGroceries,
      suggested_category_id: F.groceries,
      suggestion_source: 'planned_hint',
      auto_mapped: true,
    });
  });

  it('only suggests when two planned items match the same hint (AI-004)', async () => {
    const hint = JSON.stringify({ counterpartyPattern: 'biedronka' });
    await fixtures.query(`UPDATE planned_items SET match_hint = $3::jsonb WHERE id IN ($1, $2)`, [
      F.octGroceries,
      F.octDining,
      hint,
    ]);

    const october = await ingestRow('2026-10-05', 'oct-1');

    expect(await suggestionOf(october)).toMatchObject({
      suggestion_source: 'planned_hint',
      auto_mapped: false,
    });
  });
});
