import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  HouseholdId,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from '@power-budget/core';
import { uuidv7 } from 'uuidv7';
import type { HouseholdScope, TransferRepository } from '../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../domain/transactions/errors.js';
import type { Transfer } from '../../domain/transactions/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleTransferRepository implements TransferRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async mark(
    transactionId: TransactionId,
    counterpart: TransactionId | null,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<TransferId> {
    // Both legs must be in the caller's household (audit H10: the counterpart was unchecked).
    const ids = counterpart === null ? [transactionId] : [transactionId, counterpart];
    const own = await this.db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.id, ids),
          eq(schema.transactions.householdId, scope.householdId),
        ),
      );
    if (own.length !== new Set(ids).size) {
      throw new TransactionNotFoundError();
    }

    const transferId = uuidv7() as TransferId;
    await this.db.insert(schema.transfers).values({
      id: transferId,
      householdId: scope.householdId,
      txAId: transactionId,
      txBId: counterpart ?? null,
      markedBy: by,
      markedAt: new Date(),
    });

    return transferId;
  }

  async unmark(transactionId: TransactionId, scope: HouseholdScope): Promise<void> {
    await this.db
      .delete(schema.transfers)
      .where(
        and(
          eq(schema.transfers.txAId, transactionId),
          eq(schema.transfers.householdId, scope.householdId),
        ),
      );
  }

  async findByTransaction(id: TransactionId, scope: HouseholdScope): Promise<Transfer | null> {
    const rows = await this.db
      .select()
      .from(schema.transfers)
      .where(
        and(eq(schema.transfers.txAId, id), eq(schema.transfers.householdId, scope.householdId)),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id as TransferId,
      householdId: row.householdId as HouseholdId,
      txAId: row.txAId as TransactionId,
      txBId: (row.txBId ?? null) as TransactionId | null,
      markedBy: row.markedBy as UserId,
      markedAt: row.markedAt.toISOString() as IsoDateTime,
      status: 'active',
    };
  }
}
