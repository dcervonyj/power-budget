import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  not,
  notExists,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  BankAccountId,
  CategoryId,
  PlanId,
  PlannedItemId,
  TransactionId,
  TransferId,
  UserId,
} from '@power-budget/core';
import type { HouseholdScope, TransactionRepository } from '../../domain/transactions/ports.js';
import {
  MAPPING_ORIGINS,
  NO_BANK_DETAILS,
  PROVISIONAL_TRANSACTION_STATUSES,
} from '../../domain/transactions/entities.js';
import type {
  NewManualTransaction,
  NewTransaction,
  OwnedAccountRef,
  Page,
  ProvisionalQuery,
  ProvisionalTransactionStatus,
  Transaction,
  TransactionListItem,
  TransactionListMapping,
  TransactionPatch,
  TransactionQuery,
  TransactionSourceFilter,
  TransactionTransferLink,
  TransactionUpgrade,
  UpgradeTargetStatus,
} from '../../domain/transactions/entities.js';
import {
  CategoryNotFoundError,
  PlannedItemNotFoundError,
} from '../../domain/transactions/errors.js';
import { mappingSourceOf } from '../../domain/transactions/mapping-source.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { decodeTransactionCursor, encodeTransactionCursor } from './transactionCursor.js';
import { containsPattern } from '../database/likePattern.js';
import {
  currencyOf,
  isoDateTimeOf,
  oneOf,
  SUPPORTED_CURRENCY_CODES,
} from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';
import { TransactionRowMapper } from './TransactionRowMapper.js';

/** A transfer seen from either side: the row is its `tx_a` or its `tx_b`. */
const transferAsA = alias(schema.transfers, 'transfer_as_a');
const transferAsB = alias(schema.transfers, 'transfer_as_b');

/**
 * The bank-ingest insert columns with their SQL types. The batch travels as ONE jsonb parameter
 * read with jsonb_to_recordset, so a batch of any size is one statement with one bind parameter
 * (a multi-row VALUES list would hit Postgres' 65535 parameter cap).
 */
const BANK_INSERT_COLUMNS: readonly (readonly [string, string])[] = [
  ['id', 'uuid'],
  ['household_id', 'uuid'],
  ['account_id', 'uuid'],
  ['external_id', 'text'],
  ['occurred_on', 'date'],
  ['amount_minor', 'bigint'],
  ['currency', 'text'],
  ['description', 'text'],
  ['merchant', 'text'],
  ['source', 'text'],
  ['source_kind', 'text'],
  ['status', 'text'],
  ['ignored', 'boolean'],
  ['booking_date', 'date'],
  ['value_date', 'date'],
  ['transaction_at', 'timestamptz'],
  ['counterparty_name', 'text'],
  ['counterparty_iban_hash', 'text'],
  ['remittance', 'text'],
  ['mcc', 'text'],
  ['bank_tx_code', 'text'],
  ['entry_reference', 'text'],
  ['fingerprint', 'text'],
  ['original_amount_minor', 'bigint'],
  ['original_currency', 'text'],
  ['suggested_planned_item_id', 'uuid'],
  ['suggested_category_id', 'uuid'],
  ['suggestion_confidence', 'numeric'],
  ['suggestion_source', 'text'],
  ['auto_mapped', 'boolean'],
];

function columnName(column: readonly [string, string]): string {
  return column[0];
}

function columnDefinition(column: readonly [string, string]): string {
  return `${column[0]} ${column[1]}`;
}

/** LIMIT that never cuts rows; it only stops the planner from merging the subquery (see `pageOf`). */
const PLANNER_FENCE = Number.MAX_SAFE_INTEGER;

interface ListRow {
  readonly tx: schema.SelectTransaction;
  readonly mappingOrigin: string | null;
  readonly mappedAt: Date | null;
  readonly plannedItemId: string | null;
  readonly planId: string | null;
  readonly planName: string | null;
  readonly planArchivedAt: Date | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly categorySeedKey: string | null;
  readonly transferAsAId: string | null;
  readonly transferAsACounterpart: string | null;
  readonly transferAsBId: string | null;
  readonly transferAsBCounterpart: string | null;
}

@Injectable()
export class DrizzleTransactionRepository implements TransactionRepository {
  private readonly rows = new TransactionRowMapper();

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async insertBankBatch(inputs: readonly NewTransaction[], autoMappedBy: UserId): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const payload = JSON.stringify(inputs.map(this.toBankInsert, this), this.jsonValueOf);

    // One DB transaction: a row flagged auto-mapped must never commit without its mapping.
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        INSERT INTO transactions (${sql.raw(BANK_INSERT_COLUMNS.map(columnName).join(', '))})
        SELECT ${sql.raw(BANK_INSERT_COLUMNS.map(columnName).join(', '))}
        FROM jsonb_to_recordset(${payload}::jsonb) AS batch(${sql.raw(
          BANK_INSERT_COLUMNS.map(columnDefinition).join(', '),
        )})
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      await this.mapAutoMapped(tx, inputs, result.rows, autoMappedBy);

      return result.rows.length;
    });
  }

  async insertManual(input: NewManualTransaction): Promise<Transaction> {
    const rows = await this.db
      .insert(schema.transactions)
      .values({
        ...this.rows.toInsert({
          id: input.id,
          householdId: input.householdId,
          accountId: input.accountId,
          externalId: null,
          occurredOn: input.occurredOn,
          amount: input.amount,
          description: input.description,
          merchant: input.merchant,
          source: 'manual',
          sourceKind: 'manual',
          status: 'manual',
          bank: NO_BANK_DETAILS,
          ignored: false,
        }),
        notes: input.notes,
      })
      .returning();

    return this.rows.toEntity(rows[0]!);
  }

  async findOwnedAccount(
    accountId: BankAccountId,
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<OwnedAccountRef | null> {
    const rows = await this.db
      .select({ id: schema.bankAccounts.id, currency: schema.bankAccounts.currency })
      .from(schema.bankAccounts)
      .where(
        and(
          eq(schema.bankAccounts.id, accountId),
          eq(schema.bankAccounts.householdId, scope.householdId),
          eq(schema.bankAccounts.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    const row = rows[0];

    return row ? { id: row.id as BankAccountId, currency: currencyOf(row.currency) } : null;
  }

  async findById(id: TransactionId, scope: HouseholdScope): Promise<Transaction | null> {
    const rows = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.householdId, scope.householdId),
          this.supportedCurrency(),
        ),
      )
      .limit(1);

    return rows[0] ? this.rows.toEntity(rows[0]) : null;
  }

  async findOwnedById(
    id: TransactionId,
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<Transaction | null> {
    const rows = await this.db
      .select({ tx: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.bankAccounts, this.ownedAccountJoin(ownerUserId))
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.householdId, scope.householdId),
          this.supportedCurrency(),
        ),
      )
      .limit(1);
    const row = rows[0];

    return row ? this.rows.toEntity(row.tx) : null;
  }

  async findOwnedIds(
    ids: readonly TransactionId[],
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<TransactionId[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .innerJoin(schema.bankAccounts, this.ownedAccountJoin(ownerUserId))
      .where(
        and(
          inArray(schema.transactions.id, [...ids]),
          eq(schema.transactions.householdId, scope.householdId),
        ),
      );

    return rows.map((row) => row.id as TransactionId);
  }

  /**
   * Two steps (CLN-048): `pageOf` picks the page rows from `transactions` alone (`LIMIT n+1`), then
   * this query joins mappings, plans, categories and transfers for those rows only. Joining first
   * made every page cost grow with the caller's whole history (55k buffers on the audit fixture).
   */
  async list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<TransactionListItem>> {
    const limit = query.limit ?? 50;
    const page = this.pageOf(query, scope, limit + 1);
    // Joins the filter has already ruled out get `ON false`, so they cost nothing.
    const mappingJoin = this.joinUnless(query.unmappedOnly === true);
    const transferJoin = this.joinUnless(
      query.unmappedOnly === true || query.mapped === true || query.transfer === false,
    );

    const rows: ListRow[] = await this.db
      .select({
        tx: page._.selectedFields,
        mappingOrigin: schema.transactionMappings.source,
        mappedAt: schema.transactionMappings.mappedAt,
        plannedItemId: schema.plannedItems.id,
        planId: schema.plans.id,
        planName: schema.plans.name,
        planArchivedAt: schema.plans.archivedAt,
        categoryId: schema.plannedItems.categoryId,
        categoryName: schema.categories.name,
        categorySeedKey: schema.categories.seedKey,
        transferAsAId: transferAsA.id,
        transferAsACounterpart: transferAsA.txBId,
        transferAsBId: transferAsB.id,
        transferAsBCounterpart: transferAsB.txAId,
      })
      .from(page)
      // Each join matches at most one row (PK / unique keys), so paging stays one row per tx.
      .leftJoin(
        schema.transactionMappings,
        and(eq(schema.transactionMappings.transactionId, page.id), mappingJoin),
      )
      .leftJoin(
        schema.plannedItems,
        and(
          eq(schema.plannedItems.id, schema.transactionMappings.plannedItemId),
          eq(schema.plannedItems.householdId, page.householdId),
        ),
      )
      // Archived plans included: a mapping into last month's plan still shows its names.
      .leftJoin(schema.plans, eq(schema.plans.id, schema.plannedItems.planId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.plannedItems.categoryId))
      .leftJoin(
        transferAsA,
        and(
          eq(transferAsA.txAId, page.id),
          eq(transferAsA.householdId, page.householdId),
          transferJoin,
        ),
      )
      .leftJoin(
        transferAsB,
        and(
          eq(transferAsB.txBId, page.id),
          eq(transferAsB.householdId, page.householdId),
          transferJoin,
        ),
      )
      .orderBy(desc(page.occurredOn), desc(page.id));

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeTransactionCursor({ occurredOn: lastItem.tx.occurredOn, id: lastItem.tx.id })
        : null;

    return {
      items: items.map((row) => this.toListItem(row)),
      nextCursor,
      hasMore,
    };
  }

  async patch(id: TransactionId, patch: TransactionPatch, scope: HouseholdScope): Promise<void> {
    const columns = this.rows.patchColumns(patch);
    if (Object.keys(columns).length === 0) {
      return;
    }
    if (patch.suggestedPlannedItemId) {
      await this.assertPlannedItemInScope(patch.suggestedPlannedItemId, scope);
    }
    if (patch.suggestedCategoryId) {
      await this.assertCategoryInScope(patch.suggestedCategoryId, scope);
    }

    await this.db
      .update(schema.transactions)
      .set(columns)
      .where(
        and(eq(schema.transactions.id, id), eq(schema.transactions.householdId, scope.householdId)),
      );
  }

  async upgradeInPlace(
    upgrade: TransactionUpgrade,
    scope: HouseholdScope,
  ): Promise<Transaction | null> {
    const t = schema.transactions;
    const rows = await this.db
      .update(t)
      .set({
        status: upgrade.status,
        externalId: upgrade.externalId,
        occurredOn: upgrade.occurredOn,
        amountMinor: upgrade.amount.amountMinor,
        currency: upgrade.amount.currency,
        description: upgrade.description,
        sourceKind: upgrade.sourceKind,
        ...this.rows.bankColumns(upgrade.bank),
        // SET expressions see the row before the update: the snapshot is the provisional row.
        reconciliation: sql`jsonb_build_object(
          'upgrades',
          coalesce(${t.reconciliation} -> 'upgrades', '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'upgradedAt', ${upgrade.upgradedAt}::text,
              'from', jsonb_build_object(
                'status', ${t.status},
                'externalId', ${t.externalId},
                'occurredOn', ${t.occurredOn},
                'amountMinor', ${t.amountMinor}::text,
                'currency', ${t.currency},
                'description', ${t.description},
                'sourceKind', ${t.sourceKind},
                'fingerprint', ${t.fingerprint}
              )
            )
          )
        )`,
      })
      .where(
        and(
          eq(t.id, upgrade.id),
          eq(t.householdId, scope.householdId),
          eq(t.accountId, upgrade.accountId),
          inArray(t.status, [...this.upgradableFrom(upgrade.status)]),
        ),
      )
      .returning();
    const row = rows[0];

    return row ? this.rows.toEntity(row) : null;
  }

  async listProvisional(query: ProvisionalQuery, scope: HouseholdScope): Promise<Transaction[]> {
    const t = schema.transactions;
    const rows = await this.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.householdId, scope.householdId),
          eq(t.accountId, query.accountId),
          inArray(t.status, [...PROVISIONAL_TRANSACTION_STATUSES]),
          gte(t.occurredOn, query.window.start),
          lte(t.occurredOn, query.window.end),
          this.supportedCurrency(),
        ),
      )
      .orderBy(asc(t.occurredOn), asc(t.id));

    return rows.map((row) => this.rows.toEntity(row));
  }

  async setIgnored(
    ids: readonly TransactionId[],
    ignored: boolean,
    scope: HouseholdScope,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.db
      .update(schema.transactions)
      .set({ ignored })
      .where(
        and(
          inArray(schema.transactions.id, [...ids]),
          eq(schema.transactions.householdId, scope.householdId),
        ),
      );
  }

  // AI-004: a row the hint matcher auto-mapped gets its mapping (source 'rule', so a manual map or
  // unmap replaces it), only when the row is new: a skipped duplicate never gets one and an
  // existing mapping is never overwritten.
  private async mapAutoMapped(
    tx: Pick<NodePgDatabase<typeof schema>, 'execute'>,
    inputs: readonly NewTransaction[],
    created: readonly Record<string, unknown>[],
    autoMappedBy: UserId,
  ): Promise<void> {
    const createdIds = new Set(created.map(this.createdId, this));
    const ids = inputs
      .filter((input) => input.suggestion?.autoMapped === true && createdIds.has(input.id))
      .map((input) => input.id);
    if (ids.length === 0) {
      return;
    }

    await tx.execute(sql`
      INSERT INTO transaction_mappings
        (transaction_id, household_id, planned_item_id, amount_minor, currency, mapped_by, source)
      SELECT id, household_id, suggested_planned_item_id, amount_minor, currency,
             ${autoMappedBy}::uuid, 'rule'
      FROM transactions
      WHERE id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
        AND suggested_planned_item_id IS NOT NULL
      ON CONFLICT (transaction_id) DO NOTHING
    `);
  }

  private createdId(row: Record<string, unknown>): unknown {
    return row['id'];
  }

  /** live → pending | booked, pending → booked (plan-banking.md §1.7). */
  private upgradableFrom(target: UpgradeTargetStatus): readonly ProvisionalTransactionStatus[] {
    switch (target) {
      case 'pending':
        return ['live'];
      case 'booked':
        return PROVISIONAL_TRANSACTION_STATUSES;
      default: {
        const unreachable: never = target;
        throw new Error(`Unknown upgrade target ${String(unreachable)}`);
      }
    }
  }

  private async assertPlannedItemInScope(id: PlannedItemId, scope: HouseholdScope): Promise<void> {
    const rows = await this.db
      .select({ id: schema.plannedItems.id })
      .from(schema.plannedItems)
      .where(
        and(eq(schema.plannedItems.id, id), eq(schema.plannedItems.householdId, scope.householdId)),
      )
      .limit(1);
    if (rows.length === 0) {
      throw new PlannedItemNotFoundError();
    }
  }

  /** Household categories and the shared seed catalogue (NULL household). */
  private async assertCategoryInScope(id: CategoryId, scope: HouseholdScope): Promise<void> {
    const rows = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          or(
            isNull(schema.categories.householdId),
            eq(schema.categories.householdId, scope.householdId),
          ),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      throw new CategoryNotFoundError();
    }
  }

  /**
   * A row in a currency the app does not support (stored ignored by ingest, CLN-039) cannot be
   * mapped to the domain entity, so entity reads leave it out instead of throwing.
   */
  private supportedCurrency(): SQL {
    return inArray(schema.transactions.currency, [...SUPPORTED_CURRENCY_CODES]);
  }

  private ownedAccountJoin(ownerUserId: UserId): SQL | undefined {
    return and(
      eq(schema.bankAccounts.id, schema.transactions.accountId),
      eq(schema.bankAccounts.householdId, schema.transactions.householdId),
      eq(schema.bankAccounts.ownerUserId, ownerUserId),
    );
  }

  /**
   * The rows of one page, every `transactions` column (no second lookup by id). Without a mapping
   * filter the household/date index is walked in order and stops after `size` rows. A mapping
   * filter is tested per row, and each `transaction_mappings` probe also runs that table's RLS
   * policy (a `transactions` lookup), so the planner prefers to read every own row, probe them all
   * and sort (about 15k buffers for 3,333 rows). There the own rows are sorted first inside a
   * fenced subquery (a subquery with LIMIT is planned on its own and outer filters are not pushed
   * into it), and the mapping probe runs on them in order until the page is full.
   */
  private pageOf(query: TransactionQuery, scope: HouseholdScope, size: number) {
    const t = schema.transactions;
    const rows = this.db
      .select(getTableColumns(t))
      .from(t)
      .where(and(...this.rowConditions(query, scope)))
      .orderBy(desc(t.occurredOn), desc(t.id));
    if (!query.unmappedOnly && !this.probesMapping(query)) {
      return rows.limit(size).as('page');
    }

    const ownRows = rows.limit(PLANNER_FENCE).as('own_rows');

    return this.db
      .select(ownRows._.selectedFields)
      .from(ownRows)
      .where(and(...this.mappingConditions(query, ownRows.id)))
      .orderBy(desc(ownRows.occurredOn), desc(ownRows.id))
      .limit(size)
      .as('page');
  }

  private joinUnless(ruledOut: boolean): SQL {
    return ruledOut ? sql`false` : sql`true`;
  }

  /** Conditions on the `transactions` row and its transfers; the mapping test is separate. */
  private rowConditions(query: TransactionQuery, scope: HouseholdScope): SQL[] {
    const t = schema.transactions;
    const conditions: SQL[] = [
      eq(t.householdId, scope.householdId),
      // Only the caller's own accounts: a partner's transactions stay private.
      inArray(t.accountId, this.ownedAccountIds(query.ownerUserId, scope)),
      this.supportedCurrency(),
    ];

    if (query.accountId) {
      conditions.push(eq(t.accountId, query.accountId));
    }
    if (query.dateFrom) {
      conditions.push(gte(t.occurredOn, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(t.occurredOn, query.dateTo));
    }
    if (query.search) {
      conditions.push(ilike(t.description, containsPattern(query.search)));
    }
    if (query.status) {
      conditions.push(eq(t.status, query.status));
    }
    if (query.currency) {
      conditions.push(eq(t.currency, query.currency));
    }
    if (query.source) {
      conditions.push(this.sourceCondition(query.source));
    }
    if (query.categoryId && query.unmappedOnly) {
      // Only mapped rows have a category.
      conditions.push(sql`false`);
    }
    if (query.categoryId) {
      conditions.push(not(notInArray(t.id, this.mappedToCategory(query.categoryId, scope))));
    }
    if (query.unmappedOnly || query.mapped) {
      conditions.push(...this.notATransfer(scope), eq(t.ignored, false));
    }
    if (query.transfer === true) {
      const isTransfer = or(
        inArray(t.id, this.transferSide('a', scope)),
        inArray(t.id, this.transferSide('b', scope)),
      );
      if (isTransfer) {
        conditions.push(isTransfer, eq(t.ignored, false));
      }
    }
    if (query.transfer === false) {
      conditions.push(...this.notATransfer(scope));
    }
    // An empty cursor is invalid (400), not the first page.
    if (query.cursor !== undefined) {
      const after = decodeTransactionCursor(query.cursor);
      // Row value, not `a < x OR (a = x AND b < y)`: the planner turns it into an index bound.
      conditions.push(
        sql`(${t.occurredOn}, ${t.id}) < (${after.occurredOn}::date, ${after.id}::uuid)`,
      );
    }

    return conditions;
  }

  private mappingConditions(query: TransactionQuery, rowId: AnyPgColumn): SQL[] {
    const conditions: SQL[] = [];
    if (query.unmappedOnly) {
      conditions.push(notExists(this.mappingOf(rowId)));
    }
    if (this.probesMapping(query)) {
      conditions.push(exists(this.mappingOf(rowId)));
    }

    return conditions;
  }

  /** A row of a category is mapped already, so `mapped` needs no probe of its own there. */
  private probesMapping(query: TransactionQuery): boolean {
    return query.mapped === true && !query.categoryId;
  }

  private ownedAccountIds(ownerUserId: UserId, scope: HouseholdScope) {
    return this.db
      .select({ id: schema.bankAccounts.id })
      .from(schema.bankAccounts)
      .where(
        and(
          eq(schema.bankAccounts.householdId, scope.householdId),
          eq(schema.bankAccounts.ownerUserId, ownerUserId),
        ),
      );
  }

  /** The mapping of the transaction `rowId` (correlated subquery). */
  private mappingOf(rowId: AnyPgColumn) {
    return this.db
      .select({ one: sql`1` })
      .from(schema.transactionMappings)
      .where(eq(schema.transactionMappings.transactionId, rowId));
  }

  /**
   * The household's transactions on side `a` or `b` of a transfer. Tested with `IN` under `OR` and
   * with `NOT IN`, both stay hashed subplans: the household's transfers are read once per query,
   * not probed per row (per-row probes cost about 13k buffers for 3,333 own rows).
   */
  private transferSide(side: 'a' | 'b', scope: HouseholdScope) {
    const txId = side === 'a' ? schema.transfers.txAId : schema.transfers.txBId;

    return (
      this.db
        .select({ id: txId })
        .from(schema.transfers)
        // `NOT IN` is never true when the list holds a NULL; a one-sided transfer has no `tx_b`.
        .where(and(eq(schema.transfers.householdId, scope.householdId), isNotNull(txId)))
    );
  }

  /** `bank_sync` and `manual` test the row's `source`; a provider tests the SYNC-001 `source_kind`. */
  private sourceCondition(source: TransactionSourceFilter): SQL {
    const t = schema.transactions;
    switch (source) {
      case 'bank_sync':
      case 'manual':
        return eq(t.source, source);
      case 'enable_banking':
      case 'wise_webhook':
      case 'pko_email':
      case 'iko_push':
        return eq(t.sourceKind, source);
      default: {
        const unreachable: never = source;
        throw new Error(`Unknown transaction source filter ${String(unreachable)}`);
      }
    }
  }

  /**
   * The household's transactions mapped to a planned item of `categoryId`, tested as
   * `NOT (id NOT IN (...))`: like the transfer sides, a hashed subplan that reads the category's
   * mappings once per query. A plain `IN` becomes a semi-join; the planner underestimates the
   * category's rows and then looks each one up per own account, or probes every own row (2.7k-12k
   * buffers on the audit fixture against about 1.2k). `transaction_id` is the primary key, so the
   * list holds no NULL and the double negation is exactly `IN`.
   */
  private mappedToCategory(categoryId: CategoryId, scope: HouseholdScope) {
    return this.db
      .select({ id: schema.transactionMappings.transactionId })
      .from(schema.transactionMappings)
      .innerJoin(
        schema.plannedItems,
        eq(schema.plannedItems.id, schema.transactionMappings.plannedItemId),
      )
      .where(
        and(
          eq(schema.plannedItems.householdId, scope.householdId),
          eq(schema.plannedItems.categoryId, categoryId),
        ),
      );
  }

  private notATransfer(scope: HouseholdScope): SQL[] {
    const t = schema.transactions;

    return [
      notInArray(t.id, this.transferSide('a', scope)),
      notInArray(t.id, this.transferSide('b', scope)),
    ];
  }

  /** The insert row keyed by SQL column name, as jsonb_to_recordset reads it. */
  private toBankInsert(input: NewTransaction): Record<string, unknown> {
    const row = this.rows.toInsert(input);
    const suggestion = input.suggestion;

    return {
      suggested_planned_item_id: suggestion?.suggestedPlannedItemId ?? null,
      suggested_category_id: suggestion?.suggestedCategoryId ?? null,
      suggestion_confidence: suggestion?.suggestionConfidence ?? null,
      suggestion_source: suggestion?.suggestionSource ?? null,
      auto_mapped: suggestion?.autoMapped ?? false,
      id: row.id,
      household_id: row.householdId,
      account_id: row.accountId,
      external_id: row.externalId,
      occurred_on: row.occurredOn,
      amount_minor: row.amountMinor,
      currency: row.currency,
      description: row.description,
      merchant: row.merchant,
      source: row.source,
      source_kind: row.sourceKind,
      status: row.status,
      ignored: row.ignored,
      booking_date: row.bookingDate,
      value_date: row.valueDate,
      transaction_at: row.transactionAt,
      counterparty_name: row.counterpartyName,
      counterparty_iban_hash: row.counterpartyIbanHash,
      remittance: row.remittance,
      mcc: row.mcc,
      bank_tx_code: row.bankTxCode,
      entry_reference: row.entryReference,
      fingerprint: row.fingerprint,
      original_amount_minor: row.originalAmountMinor,
      original_currency: row.originalCurrency,
    };
  }

  /** bigint is not JSON: send it as a decimal string, which the bigint column casts back. */
  private jsonValueOf(_key: string, value: unknown): unknown {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  private toListItem(row: ListRow): TransactionListItem {
    const transaction = this.rows.toEntity(row.tx);
    const mapping = this.toListMapping(row);

    return {
      transaction,
      mapping,
      mappingSource: mappingSourceOf(
        mapping === null ? null : mapping.origin,
        transaction.suggestedPlannedItemId,
      ),
      transfer: this.toTransferLink(row),
    };
  }

  private toListMapping(row: ListRow): TransactionListMapping | null {
    if (
      row.mappingOrigin === null ||
      row.mappedAt === null ||
      row.plannedItemId === null ||
      row.planId === null ||
      row.planName === null ||
      row.categoryId === null
    ) {
      return null;
    }

    return {
      plannedItemId: row.plannedItemId as PlannedItemId,
      planId: row.planId as PlanId,
      planName: row.planName,
      planArchived: row.planArchivedAt !== null,
      categoryId: row.categoryId as CategoryId,
      categoryName: row.categoryName,
      categorySeedKey: row.categorySeedKey,
      origin: oneOf(MAPPING_ORIGINS, row.mappingOrigin, 'mapping source'),
      mappedAt: isoDateTimeOf(row.mappedAt),
    };
  }

  private toTransferLink(row: ListRow): TransactionTransferLink | null {
    if (row.transferAsAId !== null) {
      return {
        transferId: row.transferAsAId as TransferId,
        counterpartTransactionId: row.transferAsACounterpart as TransactionId | null,
      };
    }
    if (row.transferAsBId !== null) {
      return {
        transferId: row.transferAsBId as TransferId,
        counterpartTransactionId: row.transferAsBCounterpart as TransactionId | null,
      };
    }

    return null;
  }
}
