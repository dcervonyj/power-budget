import type { BankAccountId, HouseholdId, IsoDate, Money } from '@power-budget/core';
import { TransactionId, isSupportedCurrency } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/transactions/ports.js';
import type {
  BankTransactionDetails,
  IngestHashInput,
  NewTransaction,
} from '../../../domain/transactions/entities.js';
import type { RawAmount, RawTransaction } from '../../../domain/bank/entities.js';
import { IdempotentIngest } from '../../../domain/transactions/idempotent-ingest.js';

export type { RawTransaction };

export interface IngestBankTransactionsInput {
  readonly accountId: BankAccountId;
  readonly rawTransactions: readonly RawTransaction[];
  readonly householdId: HouseholdId;
}

export class IngestBankTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(input: IngestBankTransactionsInput): Promise<void> {
    const seen = new Map<string, number>();
    const batch: NewTransaction[] = [];
    for (const raw of input.rawTransactions) {
      if (this.isIngestedStatus(raw)) {
        const newTx = this.toNewTransaction(raw, input.accountId, input.householdId, seen);
        if (newTx !== null) {
          batch.push(newTx);
        }
      }
    }

    if (batch.length > 0) {
      await this.transactionRepo.insertBankBatch(batch);
    }
  }

  /**
   * Only booked rows are stored for now. Pending, cancelled, scheduled and other rows need
   * the pending/booked reconciliation of SYNC-006 (plan-banking.md §1.7); until then they are
   * skipped, as before the v2 port, when connectors returned booked rows only.
   */
  private isIngestedStatus(raw: RawTransaction): boolean {
    switch (raw.status) {
      case 'booked':
        return true;
      case 'pending':
      case 'cancelled':
      case 'scheduled':
      case 'other':
        return false;
      default: {
        const unreachable: never = raw.status;
        throw new Error(`Unknown bank transaction status ${String(unreachable)}`);
      }
    }
  }

  private toNewTransaction(
    raw: RawTransaction,
    accountId: BankAccountId,
    householdId: HouseholdId,
    seen: Map<string, number>,
  ): NewTransaction | null {
    const occurredOn = this.economicDate(raw);
    if (occurredOn === null) {
      return null;
    }

    const id = TransactionId.of(this.generateId());
    const hashInput = {
      accountId,
      occurredOn,
      amountMinor: raw.amountMinor,
      currency: raw.currency,
      normalisedDescription: IdempotentIngest.normaliseDescription(raw.remittance),
    };
    const externalId = IdempotentIngest.resolveExternalId(raw.entryReference, {
      ...hashInput,
      ordinal: this.ordinalOf(raw, hashInput, seen),
    });
    const currency = raw.currency.trim().toUpperCase();
    const supported = isSupportedCurrency(currency);

    return {
      id,
      householdId,
      accountId,
      externalId,
      occurredOn,
      // An unsupported currency is stored as received and ignored, so no reader counts it.
      amount: { amountMinor: raw.amountMinor, currency },
      description: raw.remittance,
      merchant: raw.counterpartyName,
      source: 'bank_sync',
      // Set per connector by ingest v2 (SYNC-006); NULL like the rows that predate SYNC-001.
      sourceKind: null,
      status: 'booked',
      bank: this.bankDetailsOf(raw),
      ignored: !supported,
    };
  }

  /**
   * The position of this row among identical rows (same account, day, amount and description)
   * of the fetch. Rows with a bank entry reference are keyed by it and never get an ordinal.
   */
  private ordinalOf(
    raw: RawTransaction,
    hashInput: IngestHashInput,
    seen: Map<string, number>,
  ): number {
    if (raw.entryReference !== null) {
      return 0;
    }

    const base = IdempotentIngest.computeHashKey(hashInput);
    const ordinal = seen.get(base) ?? 0;
    seen.set(base, ordinal + 1);

    return ordinal;
  }

  /** The bank fields as received; the counterparty IBAN hash and fingerprint come with SYNC-006. */
  private bankDetailsOf(raw: RawTransaction): BankTransactionDetails {
    return {
      bookingDate: raw.bookingDate,
      valueDate: raw.valueDate,
      transactionAt: null,
      counterpartyName: raw.counterpartyName,
      counterpartyIbanHash: null,
      remittance: raw.remittance === '' ? null : raw.remittance,
      mcc: raw.mcc,
      bankTxCode: raw.bankTxCode,
      entryReference: raw.entryReference,
      fingerprint: null,
      originalAmount: this.moneyOf(raw.originalAmount),
    };
  }

  private moneyOf(amount: RawAmount | null): Money | null {
    if (amount === null || !isSupportedCurrency(amount.currency)) {
      return null;
    }

    return { amountMinor: amount.amountMinor, currency: amount.currency };
  }

  /** The economic date (plan-banking.md §1.10): the transaction date, else booking, else value. */
  private economicDate(raw: RawTransaction): IsoDate | null {
    return raw.transactionDate ?? raw.bookingDate ?? raw.valueDate;
  }
}
