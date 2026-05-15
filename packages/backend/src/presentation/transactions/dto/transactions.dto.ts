import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ type: String, description: 'Filter by bank account ID' })
  accountId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Start date filter (ISO 8601)',
    example: '2024-01-01',
  })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'End date filter (ISO 8601)',
    example: '2024-12-31',
  })
  to?: string;

  @ApiPropertyOptional({ type: String, description: 'Full-text search query' })
  q?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Return only unmapped transactions' })
  unmappedOnly?: boolean;

  @ApiPropertyOptional({ type: String, description: 'Pagination cursor (last transaction ID)' })
  cursor?: string;

  @ApiPropertyOptional({ type: Number, description: 'Page size', example: 50 })
  limit?: number;
}

export class AddManualTransactionDto {
  @ApiProperty({ type: String, description: 'Bank account ID' })
  accountId!: string;

  @ApiProperty({
    type: String,
    description: 'Date of transaction (ISO 8601)',
    example: '2024-06-15',
  })
  occurredOn!: string;

  @ApiProperty({
    type: Number,
    description: 'Amount in minor currency units (e.g. cents)',
    example: 1500,
  })
  amountMinor!: number;

  @ApiProperty({ type: String, description: 'ISO 4217 currency code', example: 'PLN' })
  currency!: string;

  @ApiProperty({ type: String, example: 'Coffee at Starbucks' })
  description!: string;

  @ApiPropertyOptional({ type: String, example: 'Starbucks', nullable: true })
  merchant?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Team lunch', nullable: true })
  notes?: string | null;
}

export class PatchTransactionDto {
  @ApiPropertyOptional({ type: String, example: 'Corrected description', nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ type: Boolean, description: 'Soft-ignore the transaction from totals' })
  ignored?: boolean;
}

export class SetMappingDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Planned item ID to map to, or null to unmap',
  })
  plannedItemId!: string | null;
}

export class MarkTransferDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ID of the counterpart transaction for this transfer',
  })
  counterpartTransactionId?: string | null;
}

export class BulkMapDto {
  @ApiProperty({ type: [String], description: 'Transaction IDs to act on' })
  ids!: string[];

  @ApiProperty({ type: String, enum: ['map', 'transfer', 'ignore'] })
  op!: 'map' | 'transfer' | 'ignore';

  @ApiPropertyOptional({ type: Object, description: 'Operation-specific payload' })
  payload?: Record<string, unknown>;
}
