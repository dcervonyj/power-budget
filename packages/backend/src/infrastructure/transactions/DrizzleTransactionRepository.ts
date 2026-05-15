import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, gte, ilike, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  BankAccountId,
  CurrencyCode,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  TransactionId,
} from '@power-budget/core';
import type { HouseholdScope, TransactionRepository } from '../../domain/transactions/ports.js';
import type {
  NewManualTransaction,
  NewTransaction,
  Page,
  Transaction,
  TransactionQuery,
} from '../../domain/transactions/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';
import type { TransactionSource } from '../../domain/transactions/entities.js';

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
        ignored: false,
        notes: input.notes ?? null,
      })
      .returning();

    return this.toEntity(rows[0]!);
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

  async list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<Transaction>> {
    const limit = query.limit ?? 50;
    const conditions = [eq(schema.transactions.householdId, scope.householdId)];

    if (query.accountId) {
      conditions.push(eq(schema.transactions.accountId, query.accountId));
    }
    if (query.dateFrom) {
      conditions.push(gte(schema.transactions.occurredOn, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(schema.transactions.occurredOn, query.dateTo));
    }
    if (query.search) {
      conditions.push(ilike(schema.transactions.description, `%${query.search}%`));
    }
    if (query.cursor) {
      conditions.push(gt(schema.transactions.id, query.cursor));
    }

    const rows = await this.db
      .select()
      .from(schema.transactions)
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.occurredOn), schema.transactions.id)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return {
      items: items.map((r) => this.toEntity(r)),
      nextCursor,
      hasMore,
    };
  }

  async patch(
    id: TransactionId,
    patch: Partial<Pick<Transaction, 'notes' | 'ignored' | 'suggestedPlannedItemId'>>,
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

    await this.db.update(schema.transactions).set(updates).where(eq(schema.transactions.id, id));
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
      status: 'posted',
      ignored: row.ignored,
      notes: row.notes ?? null,
      suggestedPlannedItemId: null,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
    };
  }
}
