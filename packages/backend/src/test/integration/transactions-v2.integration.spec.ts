import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { DrizzlePlanActivityReader } from '../../infrastructure/plans/DrizzlePlanActivityReader.js';
import { DrizzleUnplannedTransactionReader } from '../../infrastructure/plans/DrizzleUnplannedTransactionReader.js';
import { NO_BANK_DETAILS } from '../../domain/transactions/entities.js';
import type {
  BankTransactionDetails,
  NewTransaction,
  TransactionStatus,
} from '../../domain/transactions/entities.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

/**
 * SYNC-001: the transactions v2 columns through DrizzleTransactionRepository, and the
 * dashboard / plan-actuals reads that leave cancelled and expired rows out, against real
 * Postgres as the least-privilege app role.
 */
interface Household {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly accountId: BankAccountId;
  readonly otherAccountId: BankAccountId;
  readonly plannedItemId: PlannedItemId;
  readonly categoryId: CategoryId;
}

let fixtures: Pool;
let appPool: Pool;
let db: NodePgDatabase<typeof schema>;
let repo: DrizzleTransactionRepository;
let H: Household;

const BOOKED_DETAILS: BankTransactionDetails = {
  bookingDate: IsoDate.of('2026-10-12'),
  valueDate: IsoDate.of('2026-10-13'),
  transactionAt: IsoDateTime.of('2026-10-11T18:45:00.000Z'),
  counterpartyName: 'Cafe Nero',
  counterpartyIbanHash: 'iban-hash',
  remittance: 'CARD 1234 CAFE NERO',
  mcc: '5812',
  bankTxCode: 'PMNT-CCRD-POSD',
  entryReference: 'entry-1',
  fingerprint: 'fp-1',
  originalAmount: { amountMinor: -500n, currency: 'EUR' },
};

async function seedHousehold(): Promise<Household> {
  const h: Household = {
    householdId: HouseholdId.of(uuidv7()),
    userId: UserId.of(uuidv7()),
    accountId: BankAccountId.of(uuidv7()),
    otherAccountId: BankAccountId.of(uuidv7()),
    plannedItemId: PlannedItemId.of(uuidv7()),
    categoryId: CategoryId.of(uuidv7()),
  };
  const connectionId = uuidv7();
  const planId = uuidv7();
  await fixtures.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
    h.userId,
    `sync001-${h.userId}@example.com`,
  ]);
  await fixtures.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`, [
    h.householdId,
  ]);
  await fixtures.query(
    `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [h.householdId, h.userId],
  );
  await fixtures.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
     VALUES ($1, $2, $3, 'enable_banking', 'PKO')`,
    [connectionId, h.householdId, h.userId],
  );
  for (const [accountId, ext] of [
    [h.accountId, 'ext-1'],
    [h.otherAccountId, 'ext-2'],
  ]) {
    await fixtures.query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
       VALUES ($1, $2, $3, $4, $5, 'Main', 'PLN')`,
      [accountId, h.householdId, h.userId, connectionId, ext],
    );
  }
  await fixtures.query(
    `INSERT INTO categories (id, household_id, name) VALUES ($1, $2, 'Eating out')`,
    [h.categoryId, h.householdId],
  );
  await fixtures.query(
    `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
     VALUES ($1, $2, $3, 'October', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
    [planId, h.householdId, h.userId],
  );
  await fixtures.query(
    `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
     VALUES ($1, $2, $3, $4, 'expense', 50000, 'PLN')`,
    [h.plannedItemId, planId, h.householdId, h.categoryId],
  );

  return h;
}

/** A raw row on `account` (default: the household's main account). */
async function insertRow(
  status: TransactionStatus,
  occurredOn: string,
  amountMinor: number,
  account: BankAccountId = H.accountId,
): Promise<TransactionId> {
  const id = TransactionId.of(uuidv7());
  await fixtures.query(
    `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, status, fingerprint)
     VALUES ($1, $2, $3, $4, $5, 'PLN', $6, $7, $8)`,
    [id, H.householdId, account, occurredOn, amountMinor, `${status} row`, status, `fp-${status}`],
  );

  return id;
}

function asHousehold<T>(fn: () => Promise<T>): Promise<T> {
  return runInDbScope({ kind: 'household', householdId: H.householdId, userId: H.userId }, fn);
}

function newBooked(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    id: TransactionId.of(uuidv7()),
    householdId: H.householdId,
    accountId: H.accountId,
    externalId: 'eb:entry-1',
    occurredOn: IsoDate.of('2026-10-11'),
    amount: { amountMinor: -2150n, currency: 'PLN' },
    description: 'CARD 1234 CAFE NERO',
    merchant: 'Cafe Nero',
    source: 'bank_sync',
    sourceKind: 'enable_banking',
    status: 'booked',
    bank: BOOKED_DETAILS,
    ignored: false,
    ...overrides,
  };
}

describe('Integration: transactions v2 repository and dashboard reads (SYNC-001)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    db = drizzle(appPool, { schema });
    repo = new DrizzleTransactionRepository(db);
  });

  beforeEach(async () => {
    await resetState();
    H = await seedHousehold();
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  it('writes and reads status, source kind, direction and the booked fields', async () => {
    const input = newBooked();
    const scope = { householdId: H.householdId };

    const { id, created } = await asHousehold(() => repo.upsertByExternalId(input));
    const stored = await asHousehold(() => repo.findById(id, scope));

    expect(created).toBe(true);
    expect(stored).toMatchObject({
      id: input.id,
      status: 'booked',
      sourceKind: 'enable_banking',
      direction: 'debit',
      externalId: 'eb:entry-1',
      occurredOn: '2026-10-11',
      amount: { amountMinor: -2150n, currency: 'PLN' },
      bank: BOOKED_DETAILS,
      reconciliation: null,
      suggestedPlannedItemId: null,
      suggestedCategoryId: null,
      suggestionConfidence: null,
      suggestionSource: null,
      autoMapped: false,
    });
  });

  it('stores a manual transaction as manual, with no bank fields', async () => {
    const tx = await asHousehold(() =>
      repo.insertManual({
        id: TransactionId.of(uuidv7()),
        householdId: H.householdId,
        accountId: H.accountId,
        occurredOn: IsoDate.of('2026-10-05'),
        amount: { amountMinor: 1000n, currency: 'PLN' },
        description: 'Refund',
        merchant: null,
        notes: 'cash',
      }),
    );

    expect(tx).toMatchObject({
      status: 'manual',
      source: 'manual',
      sourceKind: 'manual',
      direction: 'credit',
      bank: NO_BANK_DETAILS,
      notes: 'cash',
    });
  });

  it('patches the suggestion fields and keeps them on later patches', async () => {
    const id = await insertRow('booked', '2026-10-10', -900);
    const scope = { householdId: H.householdId };

    await asHousehold(() =>
      repo.patch(
        id,
        {
          suggestedPlannedItemId: H.plannedItemId,
          suggestedCategoryId: H.categoryId,
          suggestionConfidence: 0.875,
          suggestionSource: 'llm',
          autoMapped: true,
        },
        scope,
      ),
    );
    await asHousehold(() => repo.patch(id, { notes: 'lunch' }, scope));
    const tx = await asHousehold(() => repo.findById(id, scope));

    expect(tx).toMatchObject({
      notes: 'lunch',
      suggestedPlannedItemId: H.plannedItemId,
      suggestedCategoryId: H.categoryId,
      suggestionConfidence: 0.875,
      suggestionSource: 'llm',
      autoMapped: true,
    });
  });

  it('lists the live and pending rows of one account in the window, oldest first', async () => {
    const pending = await insertRow('pending', '2026-10-09', -300);
    const live = await insertRow('live', '2026-10-08', -200);
    await insertRow('booked', '2026-10-08', -100);
    await insertRow('cancelled', '2026-10-08', -100);
    await insertRow('expired', '2026-10-08', -100);
    await insertRow('live', '2026-09-30', -100);
    await insertRow('live', '2026-10-08', -100, H.otherAccountId);

    const rows = await asHousehold(() =>
      repo.listProvisional(
        {
          accountId: H.accountId,
          window: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
        },
        { householdId: H.householdId },
      ),
    );

    expect(rows.map((row) => [row.id, row.status])).toEqual([
      [live, 'live'],
      [pending, 'pending'],
    ]);
  });

  it('upgrades a live row to pending then booked in place, keeping id, mapping, notes and suggestion', async () => {
    const id = await insertRow('live', '2026-10-10', -2000);
    const scope = { householdId: H.householdId };
    await fixtures.query(
      `UPDATE transactions SET notes = 'tip included', suggested_planned_item_id = $2 WHERE id = $1`,
      [id, H.plannedItemId],
    );
    await fixtures.query(
      `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
       VALUES ($1, $2, -2000, 'PLN', $3)`,
      [id, H.plannedItemId, H.userId],
    );
    const upgrade = {
      id,
      accountId: H.accountId,
      externalId: null,
      occurredOn: IsoDate.of('2026-10-10'),
      amount: { amountMinor: -2150n, currency: 'PLN' as const },
      description: 'CARD 1234 CAFE NERO',
      sourceKind: 'enable_banking' as const,
    };

    const asPending = await asHousehold(() =>
      repo.upgradeInPlace(
        {
          ...upgrade,
          status: 'pending',
          bank: { ...NO_BANK_DETAILS, fingerprint: 'fp-eb' },
          upgradedAt: IsoDateTime.of('2026-10-10T12:00:00.000Z'),
        },
        scope,
      ),
    );
    const asBooked = await asHousehold(() =>
      repo.upgradeInPlace(
        {
          ...upgrade,
          status: 'booked',
          externalId: 'eb:entry-1',
          bank: BOOKED_DETAILS,
          upgradedAt: IsoDateTime.of('2026-10-12T06:30:00.000Z'),
        },
        scope,
      ),
    );

    expect(asPending?.status).toBe('pending');
    expect(asBooked).toMatchObject({
      id,
      status: 'booked',
      externalId: 'eb:entry-1',
      amount: { amountMinor: -2150n, currency: 'PLN' },
      sourceKind: 'enable_banking',
      bank: BOOKED_DETAILS,
      notes: 'tip included',
      suggestedPlannedItemId: H.plannedItemId,
    });
    expect(asBooked?.reconciliation).toEqual({
      upgrades: [
        {
          upgradedAt: '2026-10-10T12:00:00.000Z',
          from: {
            status: 'live',
            externalId: null,
            occurredOn: '2026-10-10',
            amount: { amountMinor: -2000n, currency: 'PLN' },
            description: 'live row',
            sourceKind: null,
            fingerprint: 'fp-live',
          },
        },
        {
          upgradedAt: '2026-10-12T06:30:00.000Z',
          from: {
            status: 'pending',
            externalId: null,
            occurredOn: '2026-10-10',
            amount: { amountMinor: -2150n, currency: 'PLN' },
            description: 'CARD 1234 CAFE NERO',
            sourceKind: 'enable_banking',
            fingerprint: 'fp-eb',
          },
        },
      ],
    });
    const mappings = await fixtures.query(
      'SELECT planned_item_id FROM transaction_mappings WHERE transaction_id = $1',
      [id],
    );
    expect(mappings.rows).toEqual([{ planned_item_id: H.plannedItemId }]);
  });

  it('refuses upgrades that are not provisional or not on the given account', async () => {
    const booked = await insertRow('booked', '2026-10-10', -100);
    const pending = await insertRow('pending', '2026-10-10', -100);
    const live = await insertRow('live', '2026-10-10', -100);
    const scope = { householdId: H.householdId };
    const base = {
      accountId: H.accountId,
      externalId: 'eb:x',
      occurredOn: IsoDate.of('2026-10-10'),
      amount: { amountMinor: -100n, currency: 'PLN' as const },
      description: 'x',
      sourceKind: 'enable_banking' as const,
      bank: NO_BANK_DETAILS,
      upgradedAt: IsoDateTime.of('2026-10-12T06:30:00.000Z'),
    };

    const results = await asHousehold(() =>
      Promise.all([
        repo.upgradeInPlace({ ...base, id: booked, status: 'booked' }, scope),
        repo.upgradeInPlace({ ...base, id: pending, status: 'pending', externalId: null }, scope),
        repo.upgradeInPlace(
          { ...base, id: live, status: 'booked', accountId: H.otherAccountId },
          scope,
        ),
      ]),
    );

    expect(results).toEqual([null, null, null]);
    const statuses = await fixtures.query(
      'SELECT status, reconciliation FROM transactions WHERE id = ANY($1) ORDER BY id',
      [[booked, pending, live]],
    );
    expect(statuses.rows).toEqual([
      { status: 'booked', reconciliation: null },
      { status: 'pending', reconciliation: null },
      { status: 'live', reconciliation: null },
    ]);
  });

  describe('dashboard and plan-actuals reads exclude cancelled and expired rows in SQL', () => {
    it('the plan activity reader returns live, pending, booked and manual rows only', async () => {
      const counted = await Promise.all(
        (['live', 'pending', 'booked', 'manual'] as const).map((status) =>
          insertRow(status, '2026-10-15', -100),
        ),
      );
      const cancelled = await insertRow('cancelled', '2026-10-15', -100);
      const expired = await insertRow('expired', '2026-10-15', -100);
      // Mappings of excluded rows are not loaded either.
      await fixtures.query(
        `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
         VALUES ($1, $3, -100, 'PLN', $4), ($2, $3, -100, 'PLN', $4)`,
        [cancelled, expired, H.plannedItemId, H.userId],
      );

      const activity = await asHousehold(() =>
        new DrizzlePlanActivityReader(db).read({
          householdId: H.householdId,
          period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
        }),
      );

      expect(activity.transactions.map((tx) => tx.id).sort()).toEqual([...counted].sort());
      expect(activity.mappings).toEqual([]);
    });

    it('the unplanned list leaves cancelled and expired rows out', async () => {
      const pending = await insertRow('pending', '2026-10-15', -100);
      const booked = await insertRow('booked', '2026-10-16', -100);
      await insertRow('cancelled', '2026-10-17', -100);
      await insertRow('expired', '2026-10-18', -100);

      const page = await asHousehold(() =>
        new DrizzleUnplannedTransactionReader(db).list({
          householdId: H.householdId,
          ownerUserId: H.userId,
          periodStart: IsoDate.of('2026-10-01'),
          periodEnd: IsoDate.of('2026-10-31'),
          direction: 'expense',
          limit: 10,
        }),
      );

      expect(page.items.map((item) => item.id)).toEqual([booked, pending]);
    });
  });
});
