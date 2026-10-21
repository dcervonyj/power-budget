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

export class AcceptInviteDto {
  @ApiProperty({
    type: String,
    description: 'Single-use token from the invite email link (`?token=`)',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class HouseholdInviteResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'partner@example.com' })
  email!: string;

  @ApiProperty({ enum: ['pending', 'expired'] })
  status!: 'pending' | 'expired';

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class HouseholdMemberResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, example: 'anna@example.com' })
  email!: string;

  @ApiProperty({ type: String, example: 'Anna', description: 'Empty when the user set none' })
  displayName!: string;

  @ApiProperty({ enum: ['owner', 'member'] })
  role!: 'owner' | 'member';

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt!: string;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'The household joined' })
  householdId!: string;

  @ApiProperty({
    type: String,
    description: 'New access token scoped to the joined household (the refresh token stays valid)',
  })
  accessToken!: string;
}
