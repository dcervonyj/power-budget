import { BANK_TX_DIRECTIONS } from '@power-budget/core';
import type { Money } from '@power-budget/core';
import {
  PROVISIONAL_TRANSACTION_STATUSES,
  SUGGESTION_SOURCES,
  TRANSACTION_SOURCE_KINDS,
  TRANSACTION_STATUSES,
} from '../../domain/transactions/entities.js';
import type {
  BankTransactionDetails,
  NewTransaction,
  ProvisionalSnapshot,
  Transaction,
  TransactionPatch,
  TransactionReconciliation,
  TransactionSource,
  TransactionUpgradeRecord,
} from '../../domain/transactions/entities.js';
import {
  currencyOf,
  isoDateOf,
  isoDateTimeOf,
  nullableIsoDateTimeOf,
  oneOf,
} from '../database/row-values.js';
import type * as schema from '../../../drizzle/schema.js';

type InsertTransaction = typeof schema.transactions.$inferInsert;
type JsonRecord = Readonly<Record<string, unknown>>;

/** The bank v2 columns of `transactions` (plan-banking.md §1.10). */
type BankColumns = Pick<
  InsertTransaction,
  | 'bookingDate'
  | 'valueDate'
  | 'transactionAt'
  | 'counterpartyName'
  | 'counterpartyIbanHash'
  | 'remittance'
  | 'mcc'
  | 'bankTxCode'
  | 'entryReference'
  | 'fingerprint'
  | 'originalAmountMinor'
  | 'originalCurrency'
>;

/** Maps `transactions` rows to the domain entity and domain inputs to column values. */
export class TransactionRowMapper {
  toEntity(row: schema.SelectTransaction): Transaction {
    return {
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      externalId: row.externalId,
      occurredOn: isoDateOf(row.occurredOn),
      amount: { amountMinor: row.amountMinor, currency: currencyOf(row.currency) },
      description: row.description,
      merchant: row.merchant,
      source: this.sourceOf(row.source),
      sourceKind:
        row.sourceKind === null
          ? null
          : oneOf(TRANSACTION_SOURCE_KINDS, row.sourceKind, 'transaction source kind'),
      status: oneOf(TRANSACTION_STATUSES, row.status, 'transaction status'),
      direction: oneOf(BANK_TX_DIRECTIONS, row.direction, 'transaction direction'),
      bank: this.bankDetailsOf(row),
      reconciliation: this.reconciliationOf(row.reconciliation),
      ignored: row.ignored,
      notes: row.notes,
      suggestedPlannedItemId: row.suggestedPlannedItemId,
      suggestedCategoryId: row.suggestedCategoryId,
      suggestionConfidence: row.suggestionConfidence,
      suggestionSource:
        row.suggestionSource === null
          ? null
          : oneOf(SUGGESTION_SOURCES, row.suggestionSource, 'suggestion source'),
      autoMapped: row.autoMapped,
      createdAt: isoDateTimeOf(row.createdAt),
    };
  }

  toInsert(input: NewTransaction): InsertTransaction {
    return {
      id: input.id,
      householdId: input.householdId,
      accountId: input.accountId,
      externalId: input.externalId,
      occurredOn: input.occurredOn,
      amountMinor: input.amount.amountMinor,
      currency: input.amount.currency,
      description: input.description,
      merchant: input.merchant,
      source: input.source,
      sourceKind: input.sourceKind,
      status: input.status,
      ignored: input.ignored,
      notes: null,
      ...this.bankColumns(input.bank),
    };
  }

  bankColumns(details: BankTransactionDetails): BankColumns {
    return {
      bookingDate: details.bookingDate,
      valueDate: details.valueDate,
      transactionAt: details.transactionAt === null ? null : new Date(details.transactionAt),
      counterpartyName: details.counterpartyName,
      counterpartyIbanHash: details.counterpartyIbanHash,
      remittance: details.remittance,
      mcc: details.mcc,
      bankTxCode: details.bankTxCode,
      entryReference: details.entryReference,
      fingerprint: details.fingerprint,
      originalAmountMinor:
        details.originalAmount === null ? null : details.originalAmount.amountMinor,
      originalCurrency: details.originalAmount === null ? null : details.originalAmount.currency,
    };
  }

  /** Only the fields present in `patch`; an empty object means nothing to change. */
  patchColumns(patch: TransactionPatch): Partial<InsertTransaction> {
    const columns: Partial<InsertTransaction> = {};
    if (patch.notes !== undefined) {
      columns.notes = patch.notes;
    }
    if (patch.ignored !== undefined) {
      columns.ignored = patch.ignored;
    }
    if (patch.suggestedPlannedItemId !== undefined) {
      columns.suggestedPlannedItemId = patch.suggestedPlannedItemId;
    }
    if (patch.suggestedCategoryId !== undefined) {
      columns.suggestedCategoryId = patch.suggestedCategoryId;
    }
    if (patch.suggestionConfidence !== undefined) {
      columns.suggestionConfidence = patch.suggestionConfidence;
    }
    if (patch.suggestionSource !== undefined) {
      columns.suggestionSource = patch.suggestionSource;
    }
    if (patch.autoMapped !== undefined) {
      columns.autoMapped = patch.autoMapped;
    }

    return columns;
  }

  private sourceOf(value: string): TransactionSource {
    return value === 'manual' ? 'manual' : 'bank_sync';
  }

  private bankDetailsOf(row: schema.SelectTransaction): BankTransactionDetails {
    return {
      bookingDate: row.bookingDate === null ? null : isoDateOf(row.bookingDate),
      valueDate: row.valueDate === null ? null : isoDateOf(row.valueDate),
      transactionAt: nullableIsoDateTimeOf(row.transactionAt),
      counterpartyName: row.counterpartyName,
      counterpartyIbanHash: row.counterpartyIbanHash,
      remittance: row.remittance,
      mcc: row.mcc,
      bankTxCode: row.bankTxCode,
      entryReference: row.entryReference,
      fingerprint: row.fingerprint,
      originalAmount: this.originalAmountOf(row.originalAmountMinor, row.originalCurrency),
    };
  }

  private originalAmountOf(amountMinor: bigint | null, currency: string | null): Money | null {
    if (amountMinor === null || currency === null) {
      return null;
    }

    return { amountMinor, currency: currencyOf(currency) };
  }

  /** `transactions.reconciliation` as written by `upgradeInPlace`; anything else throws. */
  private reconciliationOf(value: unknown): TransactionReconciliation | null {
    if (value === null) {
      return null;
    }
    const upgrades = this.recordOf(value, 'reconciliation')['upgrades'];
    if (!Array.isArray(upgrades)) {
      throw new Error('Malformed reconciliation in row: no upgrades');
    }

    return { upgrades: upgrades.map((upgrade) => this.upgradeRecordOf(upgrade)) };
  }

  private upgradeRecordOf(value: unknown): TransactionUpgradeRecord {
    const record = this.recordOf(value, 'reconciliation upgrade');

    return {
      upgradedAt: isoDateTimeOf(new Date(this.stringField(record, 'upgradedAt'))),
      from: this.snapshotOf(record['from']),
    };
  }

  private snapshotOf(value: unknown): ProvisionalSnapshot {
    const record = this.recordOf(value, 'provisional snapshot');
    const sourceKind = this.nullableStringField(record, 'sourceKind');

    return {
      status: oneOf(
        PROVISIONAL_TRANSACTION_STATUSES,
        this.stringField(record, 'status'),
        'provisional status',
      ),
      externalId: this.nullableStringField(record, 'externalId'),
      occurredOn: isoDateOf(this.stringField(record, 'occurredOn')),
      amount: {
        amountMinor: BigInt(this.stringField(record, 'amountMinor')),
        currency: currencyOf(this.stringField(record, 'currency')),
      },
      description: this.stringField(record, 'description'),
      sourceKind:
        sourceKind === null
          ? null
          : oneOf(TRANSACTION_SOURCE_KINDS, sourceKind, 'transaction source kind'),
      fingerprint: this.nullableStringField(record, 'fingerprint'),
    };
  }

  private recordOf(value: unknown, label: string): JsonRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Malformed ${label} in row`);
    }

    return Object.fromEntries(Object.entries(value));
  }

  private stringField(record: JsonRecord, key: string): string {
    const value = record[key];
    if (typeof value !== 'string') {
      throw new Error(`Malformed reconciliation in row: ${key} is not a string`);
    }

    return value;
  }

  private nullableStringField(record: JsonRecord, key: string): string | null {
    const value = record[key];
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new Error(`Malformed reconciliation in row: ${key} is not a string`);
    }

    return value;
  }
}
