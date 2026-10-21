import { parseMinorUnits } from '@power-budget/core';
import type { components } from '@power-budget/shared-app/contract';
import type {
  MappingStatus,
  Transaction,
  TransactionMapping,
} from '../../domain/transactions/Transaction.js';

export type TransactionDto = components['schemas']['TransactionDto'];
export type TransactionPageDto = components['schemas']['TransactionPageDto'];

/** `GET /transactions/:id`; mapping and transfer are typed loosely in the OpenAPI spec. */
export interface TransactionDetailDto {
  transaction: TransactionDto;
  mapping: { plannedItemId: string } | null;
  transfer: { id: string } | null;
}

export const TransactionMapper = {
  /**
   * The list endpoint carries neither the mapping nor the transfer link, so the
   * mapping is unknown unless the page was requested with `unmappedOnly=true`.
   */
  fromListItem(dto: TransactionDto, unmappedOnly: boolean): Transaction {
    return toTransaction(dto, null, false, unmappedOnly ? 'unmapped' : 'unknown');
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
