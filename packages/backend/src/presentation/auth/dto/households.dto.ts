import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateHouseholdDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;
}

export class InviteToHouseholdDto {
  @IsEmail()
  email!: string;
}
