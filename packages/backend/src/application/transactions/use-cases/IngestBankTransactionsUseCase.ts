import type { BankAccountId, HouseholdId, CurrencyCode, IsoDate, Money } from '@power-budget/core';
import { TransactionId, isSupportedCurrency } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  MappingSuggestionPort,
} from '../../../domain/transactions/ports.js';
import type {
  BankTransactionDetails,
  NewTransaction,
  TransactionMapping,
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
    private readonly mappingRepo: MappingRepository,
    private readonly suggestionPort: MappingSuggestionPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: IngestBankTransactionsInput): Promise<void> {
    for (const raw of input.rawTransactions) {
      if (this.isIngestedStatus(raw)) {
        await this.ingestOne(raw, input.accountId, input.householdId);
      }
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

  private async ingestOne(
    raw: RawTransaction,
    accountId: BankAccountId,
    householdId: HouseholdId,
  ): Promise<void> {
    const occurredOn = this.economicDate(raw);
    if (occurredOn === null) {
      return;
    }

    const id = TransactionId.of(this.generateId());
    const externalId = IdempotentIngest.resolveExternalId(raw.entryReference, {
      accountId,
      occurredOn,
      amountMinor: raw.amountMinor,
      currency: raw.currency,
      normalisedDescription: IdempotentIngest.normaliseDescription(raw.remittance),
    });

    const newTx: NewTransaction = {
      id,
      householdId,
      accountId,
      externalId,
      occurredOn,
      amount: { amountMinor: raw.amountMinor, currency: raw.currency as CurrencyCode },
      description: raw.remittance,
      merchant: raw.counterpartyName,
      source: 'bank_sync',
      // Set per connector by ingest v2 (SYNC-006); NULL like the rows that predate SYNC-001.
      sourceKind: null,
      status: 'booked',
      bank: this.bankDetailsOf(raw),
    };

    const { id: txId, created } = await this.transactionRepo.upsertByExternalId(newTx);
    if (!created) {
      return;
    }

    const tx = await this.transactionRepo.findById(txId, { householdId });
    if (tx === null) {
      return;
    }

    const recentMappings = await this.fetchRecentMappings();
    const suggestedItemId = this.suggestionPort.suggest(tx, recentMappings);
    if (suggestedItemId !== null) {
      await this.transactionRepo.patch(
        txId,
        { suggestedPlannedItemId: suggestedItemId },
        { householdId },
      );
    }
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

  private async fetchRecentMappings(): Promise<TransactionMapping[]> {
    return [];
  }

  /** The economic date (plan-banking.md §1.10): the transaction date, else booking, else value. */
  private economicDate(raw: RawTransaction): IsoDate | null {
    return raw.transactionDate ?? raw.bookingDate ?? raw.valueDate;
  }
}
