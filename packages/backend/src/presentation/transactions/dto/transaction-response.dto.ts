import { ApiProperty } from '@nestjs/swagger';
import type { TransactionDetail } from '../../../application/transactions/use-cases/GetTransactionUseCase.js';
import type {
  Page,
  Transaction,
  TransactionMapping,
  Transfer,
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

  @ApiProperty({ enum: ['pending', 'posted', 'cancelled'] })
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

export class TransactionPageDto {
  @ApiProperty({ type: [TransactionDto] })
  items!: TransactionDto[];

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

export function toTransactionPageDto(page: Page<Transaction>): TransactionPageDto {
  return {
    items: page.items.map(toTransactionDto),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export function toTransactionDetailDto(detail: TransactionDetail): TransactionDetailDto {
  return {
    transaction: toTransactionDto(detail.transaction),
    mapping: detail.mapping,
    transfer: detail.transfer,
  };
}
