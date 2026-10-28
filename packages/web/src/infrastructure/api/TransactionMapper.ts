import { parseMinorUnits } from '@power-budget/core';
import type {
  MappingSourceDto,
  TransactionDetailDto,
  TransactionDto,
  TransactionListItemDto,
  TransactionListMappingDto,
} from '@power-budget/shared-app/contract';
import type {
  MappedBy,
  Transaction,
  TransactionMapping,
} from '../../domain/transactions/Transaction.js';
import { NO_LABEL } from '../../domain/display.js';

export const TransactionMapper = {
  /** A `GET /transactions` row: it carries its mapping (with names), provenance and transfer. */
  fromListItem(dto: TransactionListItemDto): Transaction {
    return {
      ...toTransaction(dto),
      isTransfer: dto.transfer !== null && dto.transfer !== undefined,
      mapping: fromListMapping(dto.mapping, dto.mappingSource),
    };
  },

  /**
   * `GET /transactions/:id` names neither the plan nor the category, and carries no
   * provenance; only user mappings exist today (CLN-023), so a mapping reads as manual.
   */
  fromDetail(detail: TransactionDetailDto): Transaction {
    return {
      ...toTransaction(detail.transaction),
      isTransfer: detail.transfer !== null,
      mapping:
        detail.mapping === null
          ? null
          : {
              plannedItemId: detail.mapping.plannedItemId,
              planName: '',
              planArchived: false,
              categoryName: '',
              by: 'manual',
            },
    };
  },
};

function toTransaction(dto: TransactionDto): Omit<Transaction, 'isTransfer' | 'mapping'> {
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
    ignored: dto.ignored,
    notes: dto.notes,
  };
}

// The list schema marks mapping and mappingSource optional (CLN-023: web fixtures); the
// API always sends them.
function fromListMapping(
  dto: TransactionListMappingDto | null | undefined,
  source: MappingSourceDto | undefined,
): TransactionMapping | null {
  if (dto === null || dto === undefined) {
    return null;
  }

  return {
    plannedItemId: dto.plannedItemId,
    planName: dto.planName,
    planArchived: dto.planArchived,
    categoryName: dto.categoryName ?? NO_LABEL,
    by: mappedBy(source),
  };
}

function mappedBy(source: MappingSourceDto | undefined): MappedBy {
  switch (source) {
    case 'rule':
    case 'ai':
      return source;
    case 'manual':
    case 'suggestion':
    case 'none':
    case undefined:
      return 'manual';
  }
}
