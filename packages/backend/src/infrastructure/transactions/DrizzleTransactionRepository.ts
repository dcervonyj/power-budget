import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, isNull, lt, lte, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  BankAccountId,
  CategoryId,
  CurrencyCode,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  TransactionId,
  TransferId,
  UserId,
} from '@power-budget/core';
import type { HouseholdScope, TransactionRepository } from '../../domain/transactions/ports.js';
import { MAPPING_ORIGINS, TRANSACTION_STATUSES } from '../../domain/transactions/entities.js';
import type {
  NewManualTransaction,
  NewTransaction,
  OwnedAccountRef,
  Page,
  Transaction,
  TransactionListItem,
  TransactionListMapping,
  TransactionQuery,
  TransactionTransferLink,
} from '../../domain/transactions/entities.js';
import { mappingSourceOf } from '../../domain/transactions/mapping-source.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { decodeTransactionCursor, encodeTransactionCursor } from './transactionCursor.js';
import { containsPattern } from '../database/likePattern.js';
import { currencyOf, isoDateTimeOf, oneOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';
import type { TransactionSource } from '../../domain/transactions/entities.js';

/** A transfer seen from either side: the row is its `tx_a` or its `tx_b`. */
const transferAsA = alias(schema.transfers, 'transfer_as_a');
const transferAsB = alias(schema.transfers, 'transfer_as_b');

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
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async upsertByExternalId(
    input: NewTransaction,
  ): Promise<{ id: TransactionId; created: boolean }> {
    const existing = input.externalId
      ? await this.db
          .select({ id: schema.transactions.id })
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.householdId, input.householdId),
              eq(schema.transactions.accountId, input.accountId),
              eq(schema.transactions.externalId, input.externalId),
            ),
          )
          .limit(1)
      : [];

    if (existing.length > 0 && existing[0]) {
      return { id: existing[0].id as TransactionId, created: false };
    }

    const rows = await this.db
      .insert(schema.transactions)
      .values({
        id: input.id,
        householdId: input.householdId,
        accountId: input.accountId,
        externalId: input.externalId ?? null,
        occurredOn: input.occurredOn,
        amountMinor: input.amount.amountMinor,
        currency: input.amount.currency,
        description: input.description,
        merchant: input.merchant ?? null,
        source: input.source,
        status: input.status ?? 'posted',
        ignored: false,
        notes: null,
      })
      .returning({ id: schema.transactions.id });

    return { id: rows[0]!.id as TransactionId, created: true };
  }

  async insertManual(input: NewManualTransaction): Promise<Transaction> {
    const rows = await this.db
      .insert(schema.transactions)
      .values({
        id: input.id,
        householdId: input.householdId,
        accountId: input.accountId,
        externalId: null,
        occurredOn: input.occurredOn,
        amountMinor: input.amount.amountMinor,
        currency: input.amount.currency,
        description: input.description,
        merchant: input.merchant ?? null,
        source: 'manual',
        status: 'posted',
        ignored: false,
        notes: input.notes ?? null,
      })
      .returning();

    return this.toEntity(rows[0]!);
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
        and(eq(schema.transactions.id, id), eq(schema.transactions.householdId, scope.householdId)),
      )
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
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
        and(eq(schema.transactions.id, id), eq(schema.transactions.householdId, scope.householdId)),
      )
      .limit(1);
    const row = rows[0];

    return row ? this.toEntity(row.tx) : null;
  }

  async list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<TransactionListItem>> {
    const limit = query.limit ?? 50;
    const t = schema.transactions;

    const rows: ListRow[] = await this.db
      .select({
        tx: t,
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
      .from(t)
      // Only the caller's own accounts: a partner's transactions stay private.
      .innerJoin(schema.bankAccounts, this.ownedAccountJoin(query.ownerUserId))
      // Each join matches at most one row (PK / unique keys), so paging stays one row per tx.
      .leftJoin(schema.transactionMappings, eq(schema.transactionMappings.transactionId, t.id))
      .leftJoin(
        schema.plannedItems,
        and(
          eq(schema.plannedItems.id, schema.transactionMappings.plannedItemId),
          eq(schema.plannedItems.householdId, t.householdId),
        ),
      )
      // Archived plans included: a mapping into last month's plan still shows its names.
      .leftJoin(schema.plans, eq(schema.plans.id, schema.plannedItems.planId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.plannedItems.categoryId))
      .leftJoin(
        transferAsA,
        and(eq(transferAsA.txAId, t.id), eq(transferAsA.householdId, t.householdId)),
      )
      .leftJoin(
        transferAsB,
        and(eq(transferAsB.txBId, t.id), eq(transferAsB.householdId, t.householdId)),
      )
      .where(and(...this.listConditions(query, scope)))
      .orderBy(desc(t.occurredOn), desc(t.id))
      .limit(limit + 1);

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

  async patch(
    id: TransactionId,
    patch: Partial<Pick<Transaction, 'notes' | 'ignored' | 'suggestedPlannedItemId'>>,
    scope: HouseholdScope,
  ): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (patch.notes !== undefined) {
      updates['notes'] = patch.notes;
    }
    if (patch.ignored !== undefined) {
      updates['ignored'] = patch.ignored;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    await this.db
      .update(schema.transactions)
      .set(updates)
      .where(
        and(eq(schema.transactions.id, id), eq(schema.transactions.householdId, scope.householdId)),
      );
  }

  private ownedAccountJoin(ownerUserId: UserId): SQL | undefined {
    return and(
      eq(schema.bankAccounts.id, schema.transactions.accountId),
      eq(schema.bankAccounts.householdId, schema.transactions.householdId),
      eq(schema.bankAccounts.ownerUserId, ownerUserId),
    );
  }

  private listConditions(query: TransactionQuery, scope: HouseholdScope): SQL[] {
    const t = schema.transactions;
    const conditions: SQL[] = [eq(t.householdId, scope.householdId)];

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
    if (query.unmappedOnly) {
      conditions.push(
        isNull(schema.transactionMappings.transactionId),
        isNull(transferAsA.id),
        isNull(transferAsB.id),
        eq(t.ignored, false),
      );
    }
    if (query.cursor) {
      const after = decodeTransactionCursor(query.cursor);
      const keyset = or(
        lt(t.occurredOn, after.occurredOn),
        and(eq(t.occurredOn, after.occurredOn), lt(t.id, after.id)),
      );
      if (keyset) {
        conditions.push(keyset);
      }
    }

    return conditions;
  }

  private toListItem(row: ListRow): TransactionListItem {
    const transaction = this.toEntity(row.tx);
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

  private toEntity(row: schema.SelectTransaction): Transaction {
    return {
      id: row.id as TransactionId,
      householdId: row.householdId as HouseholdId,
      accountId: row.accountId as BankAccountId,
      externalId: row.externalId ?? null,
      occurredOn: row.occurredOn as IsoDate,
      amount: {
        amountMinor: row.amountMinor,
        currency: row.currency as CurrencyCode,
      },
      description: row.description,
      merchant: row.merchant ?? null,
      source: row.source as TransactionSource,
      status: oneOf(TRANSACTION_STATUSES, row.status, 'transaction status'),
      ignored: row.ignored,
      notes: row.notes ?? null,
      suggestedPlannedItemId: null,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
    };
  }
}
