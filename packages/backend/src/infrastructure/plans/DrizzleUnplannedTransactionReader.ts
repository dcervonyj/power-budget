import { Inject } from '@nestjs/common';
import { and, desc, eq, gte, lte, lt, notInArray, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  UnplannedTransactionReader,
  UnplannedTransactionPage,
  UnplannedTransactionQuery,
} from '../../domain/plans/ports.js';
import { UNCOUNTED_TRANSACTION_STATUSES } from '../../domain/transactions/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from '../transactions/transactionCursor.js';

export class DrizzleUnplannedTransactionReader implements UnplannedTransactionReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async list(query: UnplannedTransactionQuery): Promise<UnplannedTransactionPage> {
    const limit = query.limit;

    const conditions = [
      eq(schema.transactions.householdId, query.householdId),
      gte(schema.transactions.occurredOn, query.periodStart),
      lte(schema.transactions.occurredOn, query.periodEnd),
      eq(schema.transactions.ignored, false),
      // cancelled and expired rows are kept for audit only (plan-banking.md §1.7).
      notInArray(schema.transactions.status, [...UNCOUNTED_TRANSACTION_STATUSES]),
      // Only the viewer's own accounts: a partner's transactions stay private
      sql`EXISTS (
        SELECT 1 FROM bank_accounts ba
        WHERE ba.id = ${schema.transactions.accountId}
          AND ba.owner_user_id = ${query.ownerUserId}
      )`,
      // Not mapped
      sql`NOT EXISTS (
        SELECT 1 FROM transaction_mappings tm
        WHERE tm.transaction_id = ${schema.transactions.id}
      )`,
      // Not a transfer
      sql`NOT EXISTS (
        SELECT 1 FROM transfers tf
        WHERE tf.tx_a_id = ${schema.transactions.id}
           OR tf.tx_b_id = ${schema.transactions.id}
      )`,
      // Direction: income = positive amount, expense = negative amount
      query.direction === 'income'
        ? sql`${schema.transactions.amountMinor} > 0`
        : sql`${schema.transactions.amountMinor} < 0`,
    ];

    // A forged cursor throws InvalidCursorError, mapped to 400 invalid_cursor.
    if (query.cursor !== undefined) {
      const parsed = decodeTransactionCursor(query.cursor);
      conditions.push(
        or(
          lt(schema.transactions.occurredOn, parsed.occurredOn),
          and(
            eq(schema.transactions.occurredOn, parsed.occurredOn),
            lt(schema.transactions.id, parsed.id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select({
        id: schema.transactions.id,
        description: schema.transactions.description,
        amountMinor: schema.transactions.amountMinor,
        currency: schema.transactions.currency,
        occurredOn: schema.transactions.occurredOn,
        accountId: schema.transactions.accountId,
        source: schema.transactions.source,
      })
      .from(schema.transactions)
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.occurredOn), desc(schema.transactions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];

    const nextCursor =
      hasMore && lastItem
        ? encodeTransactionCursor({ occurredOn: lastItem.occurredOn, id: lastItem.id })
        : null;

    return {
      items: items.map((row) => ({
        id: row.id,
        description: row.description,
        amountMinor: row.amountMinor,
        currency: row.currency,
        occurredOn: row.occurredOn,
        accountId: row.accountId,
        source: row.source,
      })),
      nextCursor,
    };
  }
}
