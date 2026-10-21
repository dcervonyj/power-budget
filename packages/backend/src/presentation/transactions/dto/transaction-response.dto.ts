import { ApiProperty } from '@nestjs/swagger';
import type { TransactionDetail } from '../../../application/transactions/use-cases/GetTransactionUseCase.js';
import {
  MAPPING_SOURCES,
  TRANSACTION_STATUSES,
  type MappingSource,
  type Page,
  type Transaction,
  type TransactionListItem,
  type TransactionListMapping,
  type TransactionMapping,
  type TransactionTransferLink,
  type Transfer,
} from '../../../domain/transactions/entities.js';
import { MoneyDto, toMoneyDto } from '../../http/money.js';

export class TransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  accountId!: string;

  @ApiProperty({ type: String, nullable: true })
  externalId!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15' })
  occurredOn!: string;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  merchant!: string | null;

  @ApiProperty({ enum: ['bank_sync', 'manual'] })
  source!: string;

  @ApiProperty({
    enum: [...TRANSACTION_STATUSES],
    description: 'Booking status: `pending`, `posted` (booked by the bank) or `cancelled`',
  })
  status!: string;

  @ApiProperty({ type: Boolean })
  ignored!: boolean;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  suggestedPlannedItemId!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  createdAt!: string;
}

export class TransactionListMappingDto {
  @ApiProperty({ type: String })
  plannedItemId!: string;

  @ApiProperty({ type: String })
  planId!: string;

  @ApiProperty({ type: String })
  planName!: string;

  @ApiProperty({ type: Boolean, description: 'The plan is archived (mappings into it still show)' })
  planArchived!: boolean;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null only when the category row is missing',
  })
  categoryName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Seed key of a system category (for a localised name); null for own categories',
  })
  categorySeedKey!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  mappedAt!: string;
}

export class TransactionTransferLinkDto {
  @ApiProperty({ type: String })
  transferId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The other side of the transfer; null for a standalone transfer',
  })
  counterpartTransactionId!: string | null;
}

/**
 * A row of `GET /transactions`. `mapping`, `mappingSource` and `transfer` are always sent;
 * they are optional in the schema only so existing `TransactionDto` client fixtures still
 * type-check as page items (the web follow-up makes them required).
 */
export class TransactionListItemDto extends TransactionDto {
  @ApiProperty({
    type: TransactionListMappingDto,
    nullable: true,
    required: false,
    description: 'The planned item the transaction is mapped to (any plan, archived included)',
  })
  mapping?: TransactionListMappingDto | null;

  @ApiProperty({
    type: String,
    enum: [...MAPPING_SOURCES],
    required: false,
    description:
      'How the planned item was chosen: `manual` (a user), `rule` (a learned rule), `ai` (the classifier), `suggestion` (not mapped; a suggested item waits for confirmation) or `none`. Only `manual` and `none` occur today',
  })
  mappingSource?: MappingSource;

  @ApiProperty({
    type: TransactionTransferLinkDto,
    nullable: true,
    required: false,
    description: 'Set when the transaction is marked as a transfer between own accounts',
  })
  transfer?: TransactionTransferLinkDto | null;
}

export class TransactionPageDto {
  @ApiProperty({ type: [TransactionListItemDto] })
  items!: TransactionListItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: Boolean })
  hasMore!: boolean;
}

export class TransactionDetailDto {
  @ApiProperty({ type: TransactionDto })
  transaction!: TransactionDto;

  @ApiProperty({ type: Object, nullable: true, description: 'Planned-item mapping, if any' })
  mapping!: TransactionMapping | null;

  @ApiProperty({ type: Object, nullable: true, description: 'Transfer link, if any' })
  transfer!: Transfer | null;
}

export function toTransactionDto(tx: Transaction): TransactionDto {
  return {
    id: tx.id,
    accountId: tx.accountId,
    externalId: tx.externalId,
    occurredOn: tx.occurredOn,
    amount: toMoneyDto(tx.amount),
    description: tx.description,
    merchant: tx.merchant,
    source: tx.source,
    status: tx.status,
    ignored: tx.ignored,
    notes: tx.notes,
    suggestedPlannedItemId: tx.suggestedPlannedItemId,
    createdAt: tx.createdAt,
  };
}

export function toTransactionPageDto(page: Page<TransactionListItem>): TransactionPageDto {
  return {
    items: page.items.map(toTransactionListItemDto),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export function toTransactionListItemDto(item: TransactionListItem): TransactionListItemDto {
  return {
    ...toTransactionDto(item.transaction),
    mapping: item.mapping === null ? null : toListMappingDto(item.mapping),
    mappingSource: item.mappingSource,
    transfer: item.transfer === null ? null : toTransferLinkDto(item.transfer),
  };
}

function toListMappingDto(mapping: TransactionListMapping): TransactionListMappingDto {
  return {
    plannedItemId: mapping.plannedItemId,
    planId: mapping.planId,
    planName: mapping.planName,
    planArchived: mapping.planArchived,
    categoryId: mapping.categoryId,
    categoryName: mapping.categoryName,
    categorySeedKey: mapping.categorySeedKey,
    mappedAt: mapping.mappedAt,
  };
}

function toTransferLinkDto(link: TransactionTransferLink): TransactionTransferLinkDto {
  return {
    transferId: link.transferId,
    counterpartTransactionId: link.counterpartTransactionId,
  };
}

export function toTransactionDetailDto(detail: TransactionDetail): TransactionDetailDto {
  return {
    transaction: toTransactionDto(detail.transaction),
    mapping: detail.mapping,
    transfer: detail.transfer,
  };
}
