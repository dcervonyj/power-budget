import { IsString, IsNotEmpty, IsOptional, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BankAccount, BankProvider } from '../../../domain/bank/entities.js';
import { minorUnitsToString } from '../../http/money.js';

export class InitiateBankConnectionDto {
  @ApiProperty({ type: String, enum: ['gocardless', 'wise_personal'] })
  @IsIn(['gocardless', 'wise_personal'])
  provider!: BankProvider;

  @ApiProperty({
    type: String,
    description: 'Provider-specific institution/bank ID',
    example: 'PKO_BPKOPLPW',
  })
  @IsString()
  @IsNotEmpty()
  bankId!: string;

  @ApiProperty({
    type: String,
    description: 'OAuth redirect URI after consent',
    example: 'https://app.power-budget.test/connect/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

export class GetCatalogQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'PL',
  })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'country must be an ISO 3166-1 alpha-2 code' })
  country?: string;
}

export class ReconnectBankDto {
  @ApiProperty({
    type: String,
    description: 'OAuth redirect URI after consent',
    example: 'https://app.power-budget.test/connect/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

export class BankAccountDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  connectionId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  iban!: string | null;

  @ApiProperty({ type: String, example: 'PLN' })
  currency!: string;

  @ApiProperty({
    type: String,
    description: 'Balance in minor currency units as an integer string',
    example: '150000',
  })
  balanceMinor!: string;

  @ApiProperty({ type: String, nullable: true, example: '2024-06-15T10:00:00.000Z' })
  lastSyncedAt!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  createdAt!: string;
}

export function toBankAccountDto(account: BankAccount): BankAccountDto {
  return {
    id: account.id,
    connectionId: account.connectionId,
    name: account.name,
    iban: account.iban,
    currency: account.currency,
    balanceMinor: minorUnitsToString(account.balanceMinor),
    lastSyncedAt: account.lastSyncedAt === null ? null : account.lastSyncedAt.toISOString(),
    createdAt: account.createdAt.toISOString(),
  };
}
