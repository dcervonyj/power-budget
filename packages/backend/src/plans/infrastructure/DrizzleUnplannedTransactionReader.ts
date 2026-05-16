import { Inject } from '@nestjs/common';
import { and, desc, eq, gte, lte, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankAccountId, IsoDate, TransactionId } from '@power-budget/core';
import type {
  UnplannedTransactionReader,
  UnplannedTransactionPage,
  UnplannedTransactionQuery,
} from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

const DEFAULT_LIMIT = 50;

/** Cursor encodes `occurredOn|id` as base64 to support compound DESC ordering. */
function encodeCursor(occurredOn: string, id: string): string {
  return Buffer.from(`${occurredOn}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { occurredOn: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const idx = decoded.indexOf('|');
    if (idx === -1) return null;
    return { occurredOn: decoded.slice(0, idx), id: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export class DrizzleUnplannedTransactionReader implements UnplannedTransactionReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async list(query: UnplannedTransactionQuery): Promise<UnplannedTransactionPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const conditions = [
      eq(schema.transactions.householdId, query.householdId),
      gte(schema.transactions.occurredOn, query.periodStart),
      lte(schema.transactions.occurredOn, query.periodEnd),
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

    const parsed = query.cursor ? decodeCursor(query.cursor) : null;
    if (parsed) {
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

    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.occurredOn, lastItem.id) : null;

    return {
      items: items.map((row) => ({
        id: row.id as TransactionId,
        description: row.description,
        amountMinor: row.amountMinor,
        currency: row.currency,
        occurredOn: row.occurredOn as IsoDate,
        accountId: row.accountId as BankAccountId,
        source: row.source,
      })),
      nextCursor,
    };
  }
}
