import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHouseholdDto {
  @ApiProperty({ type: String, example: 'Smith Family' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ type: String, example: 'PLN', description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  baseCurrency?: string;
}

export class InviteToHouseholdDto {
  @ApiProperty({ type: String, example: 'member@example.com' })
  @IsEmail()
  email!: string;
}
