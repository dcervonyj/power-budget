import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import type { BankProvider } from '../../../domain/bank/entities.js';

export class InitiateBankConnectionDto {
  @IsIn(['gocardless', 'wise_personal'])
  provider!: BankProvider;

  @IsString()
  @IsNotEmpty()
  bankId!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

export class GetCatalogQueryDto {
  @IsOptional()
  @IsString()
  country?: string;
}
