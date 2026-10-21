import { parseMinorUnits } from '@power-budget/core';
import type { TransactionDetailDto, TransactionDto } from '@power-budget/shared-app/contract';
import type {
  MappingStatus,
  Transaction,
  TransactionMapping,
} from '../../domain/transactions/Transaction.js';

export const TransactionMapper = {
  /**
   * The list endpoint carries neither the mapping nor the transfer link (and ignores
   * `unmappedOnly`), so the mapping is unknown until the detail is read.
   */
  fromListItem(dto: TransactionDto): Transaction {
    return toTransaction(dto, null, false, 'unknown');
  },

  fromDetail(detail: TransactionDetailDto): Transaction {
    const mapping = toMapping(detail.mapping);

    return toTransaction(
      detail.transaction,
      mapping,
      detail.transfer !== null,
      mapping === null ? 'unmapped' : 'mapped',
    );
  },
};

function toTransaction(
  dto: TransactionDto,
  mapping: TransactionMapping | null,
  isTransfer: boolean,
  mappingStatus: MappingStatus,
): Transaction {
  return {
    id: dto.id,
    accountId: dto.accountId,
    occurredOn: dto.occurredOn,
    amount: { amountMinor: parseMinorUnits(dto.amount.amountMinor), currency: dto.amount.currency },
    description: dto.description,
    merchant: dto.merchant,
    source: dto.source,
    status: dto.status,
    suggestedPlannedItemId: dto.suggestedPlannedItemId,
    isTransfer,
    ignored: dto.ignored,
    notes: dto.notes,
    mapping,
    mappingStatus,
  };
}

function toMapping(dto: TransactionDetailDto['mapping']): TransactionMapping | null {
  if (dto === null) {
    return null;
  }

  return {
    plannedItemId: dto.plannedItemId,
    plannedItemName: '',
    categoryId: '',
    categoryName: '',
  };
}
