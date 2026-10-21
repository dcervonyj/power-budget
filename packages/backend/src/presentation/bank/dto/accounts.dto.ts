import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { CURRENCIES } from '@power-budget/core';
import type { Account } from '../../../domain/bank/entities.js';
import { MoneyDto, toMoneyDto } from '../../http/money.js';

const CURRENCY_CODES = Object.keys(CURRENCIES);
export const ACCOUNT_NAME_MAX = 100;

export class AccountDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({
    type: String,
    enum: ['bank', 'manual'],
    description: '`bank`: synced from a bank connection; `manual`: a cash wallet kept by hand',
  })
  kind!: 'bank' | 'manual';

  @ApiProperty({ type: String, example: 'Cash' })
  name!: string;

  @ApiProperty({ type: String, enum: CURRENCY_CODES, description: 'ISO 4217 currency code' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Bank connection; null for manual' })
  connectionId!: string | null;

  @ApiProperty({
    type: MoneyDto,
    nullable: true,
    description: 'Balance reported by the bank; null for a manual account (not tracked)',
  })
  balance!: MoneyDto | null;

  @ApiProperty({ type: String, nullable: true, example: '2024-06-15T10:00:00.000Z' })
  lastSyncedAt!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  createdAt!: string;
}

export class CreateManualAccountDto {
  @ApiProperty({ type: String, example: 'Cash', maxLength: ACCOUNT_NAME_MAX })
  @IsString()
  @Matches(/\S/, { message: 'name must not be blank' })
  @MaxLength(ACCOUNT_NAME_MAX)
  name!: string;

  @ApiProperty({ type: String, enum: CURRENCY_CODES, description: 'ISO 4217 currency code' })
  @IsIn(CURRENCY_CODES)
  currency!: string;
}

export function toAccountDto(account: Account): AccountDto {
  switch (account.kind) {
    case 'bank':
      return {
        id: account.id,
        kind: account.kind,
        name: account.name,
        currency: account.currency,
        connectionId: account.connectionId,
        balance: toMoneyDto(account.balance),
        lastSyncedAt: account.lastSyncedAt === null ? null : account.lastSyncedAt.toISOString(),
        createdAt: account.createdAt.toISOString(),
      };
    case 'manual':
      return {
        id: account.id,
        kind: account.kind,
        name: account.name,
        currency: account.currency,
        connectionId: null,
        balance: null,
        lastSyncedAt: null,
        createdAt: account.createdAt.toISOString(),
      };
    default: {
      const unreachable: never = account;

      return unreachable;
    }
  }
}
