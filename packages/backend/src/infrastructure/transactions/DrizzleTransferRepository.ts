import { TransferId } from '@power-budget/core';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { TransactionId, UserId } from '@power-budget/core';
import { uuidv7 } from 'uuidv7';
import type { HouseholdScope, TransferRepository } from '../../domain/transactions/ports.js';
import { AlreadyMappedError, TransactionNotFoundError } from '../../domain/transactions/errors.js';
import type { Transfer } from '../../domain/transactions/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';
import { isoDateTimeOf } from '../database/row-values.js';

/** The pool-bound database or a transaction on it. */
type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

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

    const transferId = TransferId.of(uuidv7());
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

  async bulkMarkStandalone(
    ids: readonly TransactionId[],
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return;
    }

    await this.db.transaction(this.bulkMarkInTransaction.bind(this, unique, by, scope));
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
      id: row.id,
      householdId: row.householdId,
      txAId: row.txAId,
      txBId: row.txBId,
      markedBy: row.markedBy,
      markedAt: isoDateTimeOf(row.markedAt),
      status: 'active',
    };
  }

  private async bulkMarkInTransaction(
    ids: TransactionId[],
    by: UserId,
    scope: HouseholdScope,
    tx: Executor,
  ): Promise<void> {
    const inScope = await tx
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.id, ids),
          eq(schema.transactions.householdId, scope.householdId),
        ),
      )
      // Row locks: a concurrent map or transfer of the same rows waits for this batch.
      .for('update');
    if (inScope.length !== ids.length) {
      throw new TransactionNotFoundError();
    }

    const mapped = await tx
      .select({ id: schema.transactionMappings.transactionId })
      .from(schema.transactionMappings)
      .where(inArray(schema.transactionMappings.transactionId, ids))
      .limit(1);
    if (mapped.length > 0) {
      throw new AlreadyMappedError();
    }

    const already = await tx
      .select({ a: schema.transfers.txAId, b: schema.transfers.txBId })
      .from(schema.transfers)
      .where(
        and(
          eq(schema.transfers.householdId, scope.householdId),
          or(inArray(schema.transfers.txAId, ids), inArray(schema.transfers.txBId, ids)),
        ),
      );
    const marked = new Set(already.flatMap((row) => [row.a, row.b]));
    const markedAt = new Date();
    const rows = ids
      .filter((id) => !marked.has(id))
      .map((id) => ({
        id: TransferId.of(uuidv7()),
        householdId: scope.householdId,
        txAId: id,
        txBId: null,
        markedBy: by,
        markedAt,
      }));
    if (rows.length === 0) {
      return;
    }

    await tx.insert(schema.transfers).values(rows);
  }
}
