import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  HouseholdId,
  IsoDateTime,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
import type { MappingRepository } from '../domain/ports.js';
import type { TransactionMapping } from '../domain/entities.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleMappingRepository implements MappingRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async set(
    transactionId: TransactionId,
    plannedItemId: PlannedItemId | null,
    by: UserId,
  ): Promise<void> {
    if (plannedItemId === null) {
      await this.db
        .delete(schema.transactionMappings)
        .where(eq(schema.transactionMappings.transactionId, transactionId));

      return;
    }

    const txRows = await this.db
      .select({
        amountMinor: schema.transactions.amountMinor,
        currency: schema.transactions.currency,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    const tx = txRows[0];
    if (!tx) {
      return;
    }

    await this.db
      .insert(schema.transactionMappings)
      .values({
        transactionId,
        plannedItemId,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        mappedBy: by,
        mappedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.transactionMappings.transactionId,
        set: {
          plannedItemId,
          mappedBy: by,
          mappedAt: new Date(),
        },
      });
  }

  async bulkSet(
    input: { transactionId: TransactionId; plannedItemId: PlannedItemId }[],
    by: UserId,
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    for (const item of input) {
      await this.set(item.transactionId, item.plannedItemId, by);
    }
  }

  async findByTransaction(id: TransactionId): Promise<TransactionMapping | null> {
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
      .where(eq(schema.transactionMappings.transactionId, id))
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
}
