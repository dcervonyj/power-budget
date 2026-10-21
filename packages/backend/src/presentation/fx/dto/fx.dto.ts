import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import { CURRENCIES } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';

const CURRENCY_CODES: readonly CurrencyCode[] = Object.values(CURRENCIES).map((c) => c.code);

export class FxRatesQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-10-20',
    description: 'Rates as of this date (YYYY-MM-DD). Defaults to today (UTC).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true })
  date?: string;

  @ApiPropertyOptional({
    enum: CURRENCY_CODES,
    example: 'PLN',
    description: 'Base currency. Defaults to EUR.',
  })
  @IsOptional()
  @IsIn(CURRENCY_CODES)
  base?: CurrencyCode;
}

export class FxRatesResponseDto {
  @ApiProperty({ type: String, format: 'date', example: '2026-10-20' })
  date!: string;

  @ApiProperty({ enum: CURRENCY_CODES, example: 'PLN' })
  baseCurrency!: CurrencyCode;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { EUR: '0.2284774264', USD: '0.2562374337', UAH: '11.5603231178' },
    description:
      '1 baseCurrency = rates[code] code, as decimal strings (never floats). ' +
      'The latest rate within 7 days of the date is used; codes without a rate are absent.',
  })
  rates!: Record<string, string>;
}
