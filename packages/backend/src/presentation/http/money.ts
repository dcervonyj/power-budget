import { ApiProperty } from '@nestjs/swagger';
import type { Money } from '@power-budget/core';

/**
 * Money on the wire (audit C8, L6): minor units as a decimal string. A bigint
 * cannot go through JSON.stringify, and Number(bigint) loses precision above 2^53.
 */
export class MoneyDto {
  @ApiProperty({
    type: String,
    description: 'Amount in minor currency units (e.g. cents) as an integer string',
    example: '150000',
  })
  amountMinor!: string;

  @ApiProperty({ type: String, description: 'ISO 4217 currency code', example: 'PLN' })
  currency!: string;
}

export function toMoneyDto(money: Money): MoneyDto {
  return { amountMinor: minorUnitsToString(money.amountMinor), currency: money.currency };
}

export function minorUnitsToString(amountMinor: bigint): string {
  return amountMinor.toString();
}
