import { formatMoneyInput, parseMinorUnits } from '@power-budget/core';
import type {
  MoneyDto,
  TransactionDetailDto,
  TransactionMappingDto,
  TransactionSourceDto,
} from '@power-budget/shared-app/contract';

/** A transaction as the mobile detail screen shows it, built from `GET /transactions/:id`. */
export interface TransactionView {
  readonly id: string;
  readonly occurredOn: string;
  readonly description: string;
  readonly merchant: string | null;
  readonly amount: MoneyDto;
  readonly source: TransactionSourceDto;
  readonly notes: string | null;
  readonly ignored: boolean;
  readonly isTransfer: boolean;
  readonly mapping: TransactionMappingDto | null;
  readonly suggestedPlannedItemId: string | null;
}

export const TransactionView = {
  fromDetail(detail: TransactionDetailDto): TransactionView {
    const { transaction } = detail;

    return {
      id: transaction.id,
      occurredOn: transaction.occurredOn,
      description: transaction.description,
      merchant: transaction.merchant,
      amount: transaction.amount,
      source: transaction.source,
      notes: transaction.notes,
      ignored: transaction.ignored,
      isTransfer: detail.transfer !== null,
      mapping: detail.mapping,
      suggestedPlannedItemId: transaction.suggestedPlannedItemId,
    };
  },
};

/** "-12.50 PLN": exact minor units (API integer string) with the currency's exponent. */
export function formatAmountText(amount: MoneyDto): string {
  try {
    return `${formatMoneyInput(parseMinorUnits(amount.amountMinor), amount.currency)} ${amount.currency}`;
  } catch {
    return `${amount.amountMinor} ${amount.currency}`;
  }
}

export function isOutgoing(amount: MoneyDto): boolean {
  return amount.amountMinor.startsWith('-');
}

/** The name a transaction goes by: the merchant, else the bank description. */
export function titleOf(view: Pick<TransactionView, 'merchant' | 'description'>): string {
  return view.merchant ?? view.description;
}
