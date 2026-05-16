import { IsEmail, IsString, IsOptional, IsIn, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { LocaleCode } from '../../domain/entities.js';

export class RegisterDto {
  @ApiProperty({ type: String, example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ type: String, enum: ['en', 'uk', 'ru', 'pl'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'uk', 'ru', 'pl'])
  locale?: LocaleCode;
}

export class LoginDto {
  @ApiProperty({ type: String, example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, example: 'Str0ngPass!' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'TOTP code if 2FA is enabled',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  totp?: string;
}

export class RequestMagicLinkDto {
  @ApiProperty({ type: String, example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class ConsumeMagicLinkDto {
  @ApiProperty({ type: String, description: 'Magic-link token from email' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class VerifyTotpDto {
  @ApiProperty({ type: String, description: '6-digit TOTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ type: String, description: 'Opaque refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ type: String, description: 'Refresh token to revoke' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
