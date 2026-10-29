import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CURRENCIES, SUPPORTED_LOCALES } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type { LocaleCode } from '../../../domain/auth/entities.js';
import type { UserProfile } from '../../../domain/auth/profile.js';
import { MAX_INTERESTING_CURRENCIES, UserPreferences } from '../../../domain/auth/profile.js';

const LOCALES: readonly LocaleCode[] = SUPPORTED_LOCALES;
const CURRENCY_CODES = Object.keys(CURRENCIES);

export class UpdateLocaleDto {
  @ApiProperty({ type: String, enum: LOCALES, example: 'en' })
  @IsIn(LOCALES)
  locale!: LocaleCode;
}

/** PATCH /users/me. Every field is optional; omitted fields are left unchanged. */
export class UpdateUserProfileDto {
  @ApiPropertyOptional({ type: String, maxLength: 255, example: 'Anna' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ type: String, enum: LOCALES, example: 'pl' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: LocaleCode;

  @ApiPropertyOptional({ type: String, enum: CURRENCY_CODES, example: 'PLN' })
  @IsOptional()
  @IsIn(CURRENCY_CODES)
  baseCurrency?: CurrencyCode;

  @ApiPropertyOptional({
    type: String,
    maxLength: 64,
    description: 'IANA time zone name',
    example: 'Europe/Warsaw',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_INTERESTING_CURRENCIES,
    description: 'Currencies tracked next to the base currency; replaces the stored list',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INTERESTING_CURRENCIES)
  @ArrayUnique()
  @Matches(/^[A-Z]{3}$/, { each: true })
  interestingCurrencies?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Set true when the user finishes onboarding; false resets it',
  })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class UserProfileDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'anna@example.com' })
  email!: string;

  @ApiProperty({ type: String, example: 'Anna' })
  displayName!: string;

  @ApiProperty({
    type: String,
    enum: LOCALES,
    description: 'Effective locale: the preference, else the default',
  })
  locale!: string;

  @ApiProperty({ type: String, enum: LOCALES, nullable: true })
  localePreference!: string | null;

  @ApiProperty({ type: String, enum: LOCALES })
  defaultLocale!: string;

  @ApiProperty({
    type: String,
    enum: CURRENCY_CODES,
    nullable: true,
    description: "Effective base currency: the user's preference, else the household's",
  })
  baseCurrency!: string | null;

  @ApiProperty({ type: String, example: 'Europe/Warsaw', description: 'IANA time zone name' })
  timezone!: string;

  @ApiProperty({
    type: [String],
    description: 'Currencies the user tracks next to the base currency',
  })
  interestingCurrencies!: string[];

  @ApiProperty({ type: Boolean, description: 'Whether the user has completed onboarding' })
  onboardingCompleted!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  householdId!: string | null;
}

export function toUserProfileDto(profile: UserProfile): UserProfileDto {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    locale: UserPreferences.effectiveLocale(profile),
    localePreference: profile.localePreference,
    defaultLocale: profile.defaultLocale,
    baseCurrency: UserPreferences.effectiveBaseCurrency(profile),
    timezone: profile.timezone,
    interestingCurrencies: [...profile.interestingCurrencies],
    onboardingCompleted: profile.onboardingCompleted,
    householdId: profile.householdId,
  };
}
