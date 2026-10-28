import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type {
  CurrencyCode,
  HouseholdId,
  IsoDateTime,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
import type { HouseholdScope, MappingRepository } from '../../domain/transactions/ports.js';
import type { TransactionMapping } from '../../domain/transactions/entities.js';
import {
  PlannedItemNotFoundError,
  TransactionNotFoundError,
} from '../../domain/transactions/errors.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { SUPPORTED_CURRENCY_CODES } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

/** The pool-bound database or a transaction on it. */
type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

interface MappedAmount {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

@Injectable()
export class DrizzleMappingRepository implements MappingRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async set(
    transactionId: TransactionId,
    plannedItemId: PlannedItemId | null,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void> {
    const amounts = await this.amountsInScope(this.db, [transactionId], scope);
    const amount = amounts.get(transactionId);
    if (!amount) {
      throw new TransactionNotFoundError();
    }

    if (plannedItemId === null) {
      await this.db
        .delete(schema.transactionMappings)
        .where(eq(schema.transactionMappings.transactionId, transactionId));

      return;
    }

    await this.assertPlannedItemsInScope(this.db, [plannedItemId], scope);
    await this.upsert(this.db, transactionId, plannedItemId, amount, by, scope);
  }

  async bulkSet(
    input: { transactionId: TransactionId; plannedItemId: PlannedItemId }[],
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.transaction(this.bulkSetInTransaction.bind(this, input, by, scope));
  }

  async findByTransaction(
    id: TransactionId,
    scope: HouseholdScope,
  ): Promise<TransactionMapping | null> {
    const rows = await this.db
      .select({
        mapping: schema.transactionMappings,
        householdId: schema.transactions.householdId,
      })
      .from(schema.transactionMappings)
      .innerJoin(
        schema.transactions,
        eq(schema.transactionMappings.transactionId, schema.transactions.id),
      )
      .where(
        and(
          eq(schema.transactionMappings.transactionId, id),
          eq(schema.transactions.householdId, scope.householdId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      // transactionId serves as id since transactionId is the PK
      id: row.mapping.transactionId as TransactionMappingId,
      transactionId: row.mapping.transactionId as TransactionId,
      plannedItemId: row.mapping.plannedItemId as PlannedItemId,
      householdId: row.householdId as HouseholdId,
      mappedBy: row.mapping.mappedBy as UserId,
      mappedAt: row.mapping.mappedAt.toISOString() as IsoDateTime,
    };
  }

  private async bulkSetInTransaction(
    input: { transactionId: TransactionId; plannedItemId: PlannedItemId }[],
    by: UserId,
    scope: HouseholdScope,
    tx: Executor,
  ): Promise<void> {
    const transactionIds = [...new Set(input.map((item) => item.transactionId))];
    const amounts = await this.amountsInScope(tx, transactionIds, scope);
    if (amounts.size !== transactionIds.length) {
      throw new TransactionNotFoundError();
    }
    await this.assertPlannedItemsInScope(
      tx,
      input.map((item) => item.plannedItemId),
      scope,
    );

    for (const item of input) {
      const amount = amounts.get(item.transactionId);
      if (!amount) {
        throw new TransactionNotFoundError();
      }
      await this.upsert(tx, item.transactionId, item.plannedItemId, amount, by, scope);
    }
  }

  private async amountsInScope(
    db: Executor,
    transactionIds: TransactionId[],
    scope: HouseholdScope,
  ): Promise<Map<TransactionId, MappedAmount>> {
    const rows = await db
      .select({
        id: schema.transactions.id,
        amountMinor: schema.transactions.amountMinor,
        currency: schema.transactions.currency,
      })
      .from(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.id, transactionIds),
          eq(schema.transactions.householdId, scope.householdId),
          // An unsupported-currency row (CLN-039) cannot be mapped to a plan item.
          inArray(schema.transactions.currency, [...SUPPORTED_CURRENCY_CODES]),
        ),
      );

    return new Map(
      rows.map((row) => [
        row.id as TransactionId,
        { amountMinor: row.amountMinor, currency: row.currency as CurrencyCode },
      ]),
    );
  }

  private async assertPlannedItemsInScope(
    db: Executor,
    plannedItemIds: PlannedItemId[],
    scope: HouseholdScope,
  ): Promise<void> {
    const unique = [...new Set(plannedItemIds)];
    const rows = await db
      .select({ id: schema.plannedItems.id })
      .from(schema.plannedItems)
      .where(
        and(
          inArray(schema.plannedItems.id, unique),
          eq(schema.plannedItems.householdId, scope.householdId),
        ),
      );
    if (rows.length !== unique.length) {
      throw new PlannedItemNotFoundError();
    }
  }

  private async upsert(
    db: Executor,
    transactionId: TransactionId,
    plannedItemId: PlannedItemId,
    amount: MappedAmount,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void> {
    await db
      .insert(schema.transactionMappings)
      .values({
        transactionId,
        // CLN-051: the transaction's household (checked by amountsInScope); the RLS policy and
        // the (transaction_id, household_id) foreign key rely on it.
        householdId: scope.householdId,
        plannedItemId,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        mappedBy: by,
        mappedAt: new Date(),
        source: 'manual',
      })
      .onConflictDoUpdate({
        target: schema.transactionMappings.transactionId,
        // A user's choice replaces any rule or AI mapping.
        set: {
          plannedItemId,
          mappedBy: by,
          mappedAt: new Date(),
          source: 'manual',
        },
      });
  }
}
