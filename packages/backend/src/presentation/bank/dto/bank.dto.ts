import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BankProvider } from '../../../domain/bank/entities.js';

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
  @IsString()
  country?: string;
}
