import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CURRENCIES } from '@power-budget/core';
import {
  TRANSACTION_STATUSES,
  type TransactionStatus,
} from '../../../domain/transactions/entities.js';
import {
  ClampMax,
  ISO_DATE_PATTERN,
  MINOR_UNITS_PATTERN,
  ToBoolean,
  ToMinorUnitsString,
} from '../../http/validators.js';

export const TRANSACTIONS_PAGE_MAX = 200;
export const BULK_IDS_MAX = 500;
const CURRENCY_CODES = Object.keys(CURRENCIES);
/** At least one non-zero digit. */
const NON_ZERO_PATTERN = /[1-9]/;

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ type: String, description: 'Filter by bank account ID' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Start date filter (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be a YYYY-MM-DD date' })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'End date filter (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be a YYYY-MM-DD date' })
  to?: string;

  @ApiPropertyOptional({ type: String, description: 'Full-text search query' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Return only transactions that still need a decision: no mapping, not a transfer, not ignored',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unmappedOnly?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Return only transactions mapped to a planned item (not a transfer, not ignored); `false` adds no filter, use `unmappedOnly` for the opposite',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  mapped?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      '`true`: only internal transfers (not ignored); `false`: only transactions that are not part of a transfer',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  transfer?: boolean;

  @ApiPropertyOptional({
    type: String,
    enum: [...TRANSACTION_STATUSES],
    description: 'Row lifecycle filter (`booked` is booked by the bank)',
  })
  @IsOptional()
  @IsIn([...TRANSACTION_STATUSES])
  status?: TransactionStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Opaque pagination cursor (`nextCursor` of the previous page)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({
    type: Number,
    description: `Page size (default 50, values above ${TRANSACTIONS_PAGE_MAX} are clamped)`,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ClampMax(TRANSACTIONS_PAGE_MAX)
  limit?: number;
}

export class AddManualTransactionDto {
  @ApiProperty({
    type: String,
    description: "One of the caller's own accounts (`GET /accounts`); another user's reads as 404",
  })
  @IsUUID()
  accountId!: string;

  @ApiProperty({
    type: String,
    description: 'Date of transaction (YYYY-MM-DD)',
    example: '2024-06-15',
  })
  @Matches(ISO_DATE_PATTERN, { message: 'occurredOn must be a YYYY-MM-DD date' })
  occurredOn!: string;

  @ApiProperty({
    type: String,
    description:
      'Non-zero amount in minor units of `currency` (10^exponent per unit, e.g. cents for PLN) as an integer string; negative = outgoing. A safe JSON integer is also accepted; decimals are rejected',
    example: '-1500',
  })
  @ToMinorUnitsString()
  @Matches(MINOR_UNITS_PATTERN, { message: 'amountMinor must be an integer amount in minor units' })
  @Matches(NON_ZERO_PATTERN, { message: 'amountMinor must not be zero' })
  amountMinor!: string;

  @ApiProperty({
    type: String,
    enum: CURRENCY_CODES,
    description: 'ISO 4217 currency code; must be the account currency (400 otherwise)',
  })
  @IsIn(CURRENCY_CODES)
  currency!: string;

  @ApiProperty({ type: String, example: 'Coffee at Starbucks' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ type: String, example: 'Starbucks', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchant?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Team lunch', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class PatchTransactionDto {
  @ApiPropertyOptional({ type: String, example: 'Corrected description', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ type: Boolean, description: 'Soft-ignore the transaction from totals' })
  @IsOptional()
  @IsBoolean()
  ignored?: boolean;
}

export class SetMappingDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Planned item ID to map to, or null to unmap',
  })
  @ValidateIf((dto: SetMappingDto) => dto.plannedItemId !== null)
  @IsUUID()
  plannedItemId!: string | null;
}

export class MarkTransferDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ID of the counterpart transaction for this transfer',
  })
  @IsOptional()
  @IsUUID()
  counterpartTransactionId?: string | null;
}

export class BulkMapDto {
  @ApiProperty({ type: [String], description: `Transaction IDs to act on (max ${BULK_IDS_MAX})` })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BULK_IDS_MAX)
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiProperty({ type: String, enum: ['map', 'transfer', 'ignore'] })
  @IsIn(['map', 'transfer', 'ignore'])
  op!: 'map' | 'transfer' | 'ignore';

  @ApiPropertyOptional({ type: Object, description: 'Operation-specific payload' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
