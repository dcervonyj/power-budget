import type { BankAccountId, HouseholdId, CurrencyCode, IsoDate } from '@power-budget/core';
import { TransactionId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  MappingSuggestionPort,
} from '../../../domain/transactions/ports.js';
import type { NewTransaction, TransactionMapping } from '../../../domain/transactions/entities.js';
import { IdempotentIngest } from '../../../domain/transactions/idempotent-ingest.js';

export interface RawTransaction {
  readonly externalId: string | null;
  readonly occurredOn: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly merchant: string | null;
}

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
      await this.ingestOne(raw, input.accountId, input.householdId);
    }
  }

  private async ingestOne(
    raw: RawTransaction,
    accountId: BankAccountId,
    householdId: HouseholdId,
  ): Promise<void> {
    const id = TransactionId.of(this.generateId());
    const externalId = IdempotentIngest.resolveExternalId(raw.externalId, {
      accountId,
      occurredOn: raw.occurredOn as IsoDate,
      amountMinor: raw.amountMinor,
      currency: raw.currency,
      normalisedDescription: IdempotentIngest.normaliseDescription(raw.description),
    });

    const newTx: NewTransaction = {
      id,
      householdId,
      accountId,
      externalId,
      occurredOn: raw.occurredOn as IsoDate,
      amount: { amountMinor: raw.amountMinor, currency: raw.currency as CurrencyCode },
      description: raw.description,
      merchant: raw.merchant,
      source: 'bank_sync',
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
      await this.transactionRepo.patch(txId, { suggestedPlannedItemId: suggestedItemId });
    }
  }

  private async fetchRecentMappings(): Promise<TransactionMapping[]> {
    return [];
  }
}
