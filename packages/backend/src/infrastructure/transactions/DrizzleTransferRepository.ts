import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  HouseholdId,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from '@power-budget/core';
import { uuidv7 } from 'uuidv7';
import type { TransferRepository } from '../../domain/transactions/ports.js';
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
  ): Promise<TransferId> {
    const txRows = await this.db
      .select({ householdId: schema.transactions.householdId })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    const tx = txRows[0];
    if (!tx) {
      throw new Error('Transaction not found');
    }

    const transferId = uuidv7() as TransferId;
    await this.db.insert(schema.transfers).values({
      id: transferId,
      householdId: tx.householdId,
      txAId: transactionId,
      txBId: counterpart ?? null,
      markedBy: by,
      markedAt: new Date(),
    });

    return transferId;
  }

  async unmark(transactionId: TransactionId): Promise<void> {
    await this.db.delete(schema.transfers).where(eq(schema.transfers.txAId, transactionId));
  }

  async findByTransaction(id: TransactionId): Promise<Transfer | null> {
    const rows = await this.db
      .select()
      .from(schema.transfers)
      .where(eq(schema.transfers.txAId, id))
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
