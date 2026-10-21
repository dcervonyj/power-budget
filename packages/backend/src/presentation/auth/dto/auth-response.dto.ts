import { ApiProperty } from '@nestjs/swagger';
import type { UserId } from '@power-budget/core';

/** Tokens issued by register, login, magic-link consume and refresh. */
export class AuthTokensDto {
  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String, description: 'Short-lived JWT access token' })
  accessToken!: string;

  @ApiProperty({ type: String, description: 'Opaque refresh token' })
  refreshToken!: string;
}

export class TotpEnrollmentDto {
  @ApiProperty({ type: String, description: 'otpauth:// URI to render as a QR code' })
  qrCodeUri!: string;

  @ApiProperty({ type: String, description: 'Base32 TOTP secret for manual entry' })
  secret!: string;
}

export function toAuthTokensDto(tokens: {
  readonly userId: UserId;
  readonly accessToken: string;
  readonly refreshToken: string;
}): AuthTokensDto {
  return {
    userId: tokens.userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export function toTotpEnrollmentDto(enrollment: {
  readonly qrCodeUri: string;
  readonly secret: string;
}): TotpEnrollmentDto {
  return { qrCodeUri: enrollment.qrCodeUri, secret: enrollment.secret };
}
