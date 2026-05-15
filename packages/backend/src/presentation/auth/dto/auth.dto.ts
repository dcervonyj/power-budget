import { IsEmail, IsString, IsOptional, IsIn, IsNotEmpty, MinLength } from 'class-validator';
import type { LocaleCode } from '../../../domain/auth/entities.js';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['en', 'uk', 'ru', 'pl'])
  locale?: LocaleCode;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  totp?: string;
}

export class RequestMagicLinkDto {
  @IsEmail()
  email!: string;
}

export class ConsumeMagicLinkDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class VerifyTotpDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
