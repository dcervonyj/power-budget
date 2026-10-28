import { isSupportedCurrency, matchPlannedItemHints } from '@power-budget/core';
import type {
  CurrencyCode,
  HouseholdId,
  HintTransaction,
  IsoDate,
  UserId,
} from '@power-budget/core';
import type { HintedPlannedItem } from '../../domain/categorisation/entities.js';
import type { PlannedHintReader } from '../../domain/categorisation/ports.js';
import type {
  NewTransaction,
  TransactionSuggestionFields,
} from '../../domain/transactions/entities.js';

/**
 * Planned item hints at ingest (AI-004), tried before merchant memory (plan-banking.md §1.13):
 * scores the hinted planned items of the plans that cover the transaction date. A unique match
 * at or above the auto-map confidence is flagged `autoMapped`; two matching items stay a
 * suggestion. Rows that already carry a suggestion are left alone.
 */
export class SuggestFromPlannedHintsUseCase {
  constructor(private readonly hints: PlannedHintReader) {}

  async suggest(
    rows: readonly NewTransaction[],
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<NewTransaction[]> {
    const candidates = await this.candidatesFor(rows, ownerUserId, householdId);
    if (candidates.length === 0) {
      return [...rows];
    }

    return rows.map((row) => this.withSuggestion(row, candidates));
  }

  private async candidatesFor(
    rows: readonly NewTransaction[],
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<HintedPlannedItem[]> {
    const dates = rows.filter((row) => !row.ignored).map((row) => row.occurredOn);
    const first = dates.reduce(this.earlier, dates[0]);
    const last = dates.reduce(this.later, dates[0]);
    if (first === undefined || last === undefined) {
      return [];
    }

    return this.hints.listHinted({ householdId, ownerUserId, from: first, to: last });
  }

  private withSuggestion(
    row: NewTransaction,
    candidates: readonly HintedPlannedItem[],
  ): NewTransaction {
    const { currency } = row.amount;
    if (row.ignored || row.suggestion !== undefined || !isSupportedCurrency(currency)) {
      return row;
    }
    const covering = candidates.filter(
      (item) => item.periodStart <= row.occurredOn && row.occurredOn <= item.periodEnd,
    );
    const match = matchPlannedItemHints(this.toHintTransaction(row, currency), covering);
    const item = covering.find((candidate) => candidate.plannedItemId === match?.plannedItemId);
    if (match === null || item === undefined) {
      return row;
    }
    const suggestion: TransactionSuggestionFields = {
      suggestedPlannedItemId: match.plannedItemId,
      suggestedCategoryId: item.categoryId,
      suggestionConfidence: match.confidence,
      suggestionSource: 'planned_hint',
      autoMapped: match.autoMap,
    };

    return { ...row, suggestion };
  }

  private toHintTransaction(row: NewTransaction, currency: CurrencyCode): HintTransaction {
    const negative = row.amount.amountMinor < 0n;

    return {
      direction: negative ? 'expense' : 'income',
      amount: {
        amountMinor: negative ? -row.amount.amountMinor : row.amount.amountMinor,
        currency,
      },
      occurredOn: row.occurredOn,
      description: row.description,
      merchant: row.merchant,
      counterparty: row.bank.counterpartyName,
    };
  }

  private earlier(a: IsoDate | undefined, b: IsoDate): IsoDate {
    return a === undefined || b < a ? b : a;
  }

  private later(a: IsoDate | undefined, b: IsoDate): IsoDate {
    return a === undefined || b > a ? b : a;
  }
}
