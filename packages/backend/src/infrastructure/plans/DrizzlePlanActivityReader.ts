import { Inject } from '@nestjs/common';
import { and, eq, gte, inArray, lte, notInArray, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  BankAccountId,
  HouseholdId,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  TransferId,
  UserId,
} from '@power-budget/core';
import type { Mapping, Transaction, Transfer } from '@power-budget/core';
import type {
  PlanActivity,
  PlanActivityQuery,
  PlanActivityReader,
} from '../../domain/plans/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { currencyOf, isoDateOf, isoDateTimeOf, oneOf } from '../database/row-values.js';
import {
  TRANSACTION_STATUSES,
  UNCOUNTED_TRANSACTION_STATUSES,
} from '../../domain/transactions/entities.js';
import * as schema from '../../../drizzle/schema.js';

type TransactionRow = typeof schema.transactions.$inferSelect;
type MappingRow = typeof schema.transactionMappings.$inferSelect;
type TransferRow = typeof schema.transfers.$inferSelect;

/**
 * Loads a period of household activity for the core dashboard functions. No
 * totals are computed in SQL: amounts in different currencies cannot be summed
 * before conversion, and ignored/transfer/privacy rules live in core.
 */
export class DrizzlePlanActivityReader implements PlanActivityReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async read(query: PlanActivityQuery): Promise<PlanActivity> {
    const inPeriod = and(
      eq(schema.transactions.householdId, query.householdId),
      gte(schema.transactions.occurredOn, query.period.start),
      lte(schema.transactions.occurredOn, query.period.end),
      // cancelled and expired rows are kept for audit only (plan-banking.md §1.7).
      notInArray(schema.transactions.status, [...UNCOUNTED_TRANSACTION_STATUSES]),
    );
    const periodTxIds = this.db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(inPeriod);

    const [txRows, mappingRows, transferRows] = await Promise.all([
      this.db
        // The account owner, for bank and manual (connection-less) accounts alike.
        .select({ tx: schema.transactions, ownerUserId: schema.bankAccounts.ownerUserId })
        .from(schema.transactions)
        .innerJoin(schema.bankAccounts, eq(schema.transactions.accountId, schema.bankAccounts.id))
        .where(inPeriod),
      this.db
        .select()
        .from(schema.transactionMappings)
        .where(inArray(schema.transactionMappings.transactionId, periodTxIds)),
      this.db
        .select()
        .from(schema.transfers)
        .where(
          and(
            eq(schema.transfers.householdId, query.householdId),
            or(
              inArray(schema.transfers.txAId, periodTxIds),
              inArray(schema.transfers.txBId, periodTxIds),
            ),
          ),
        ),
    ]);

    const owners = new Map<TransactionId, UserId>();
    const transactions: Transaction[] = [];
    for (const row of txRows) {
      const tx = this.toTransaction(row.tx);
      transactions.push(tx);
      owners.set(tx.id, UserId.of(row.ownerUserId));
    }

    return {
      transactions,
      owners,
      mappings: mappingRows.map((row) => this.toMapping(row, query.householdId)),
      transfers: transferRows.map((row) => this.toTransfer(row)),
    };
  }

  private toTransaction(row: TransactionRow): Transaction {
    return {
      id: TransactionId.of(row.id),
      householdId: HouseholdId.of(row.householdId),
      accountId: BankAccountId.of(row.accountId),
      externalId: row.externalId,
      source: row.source === 'manual' ? 'manual' : 'bank',
      status: oneOf(TRANSACTION_STATUSES, row.status, 'transaction status'),
      amount: { amountMinor: row.amountMinor, currency: currencyOf(row.currency) },
      description: row.description,
      merchantName: row.merchant,
      bookedAt: isoDateOf(row.occurredOn),
      createdAt: isoDateTimeOf(row.createdAt),
      ignored: row.ignored,
    };
  }

  /** transaction_mappings is keyed by the transaction: one mapping per transaction. */
  private toMapping(row: MappingRow, householdId: HouseholdId): Mapping {
    return {
      id: TransactionMappingId.of(row.transactionId),
      householdId,
      transactionId: TransactionId.of(row.transactionId),
      plannedItemId: PlannedItemId.of(row.plannedItemId),
      createdByUserId: UserId.of(row.mappedBy),
      createdAt: isoDateTimeOf(row.mappedAt),
    };
  }

  /** An unmark deletes the row, so every stored transfer is active. */
  private toTransfer(row: TransferRow): Transfer {
    return {
      id: TransferId.of(row.id),
      householdId: HouseholdId.of(row.householdId),
      fromTransactionId: TransactionId.of(row.txAId),
      toTransactionId: row.txBId === null ? null : TransactionId.of(row.txBId),
      status: 'active',
      createdAt: isoDateTimeOf(row.markedAt),
    };
  }
}
