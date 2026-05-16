import type { UserId, HouseholdId, HouseholdExportId } from '@power-budget/core';
import type { LocaleCode } from '../../domain/entities.js';

export interface AcceptInviteInput {
  readonly token: string;
  readonly acceptingUserId: UserId;
}

export interface ConsumeMagicLinkInput {
  readonly token: string;
}

export interface ConsumeMagicLinkOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export interface CreateHouseholdInput {
  readonly userId: UserId;
  readonly name: string;
  readonly baseCurrency?: string;
}

export interface DeleteHouseholdInput {
  readonly householdId: HouseholdId;
  readonly requestedByUserId: UserId;
}

export interface DeleteHouseholdOutput {
  readonly scheduledFor: Date;
}

export interface EnableTotpInput {
  readonly userId: UserId;
}

export interface EnableTotpOutput {
  readonly qrCodeUri: string;
  readonly secret: string;
}

export interface ExportHouseholdDataInput {
  readonly householdId: HouseholdId;
  readonly requestedByUserId: UserId;
}

export interface ExportHouseholdDataOutput {
  readonly exportId: HouseholdExportId;
  readonly status: 'pending';
}

export interface GetCurrentUserInput {
  readonly userId: UserId;
}

export interface InviteToHouseholdInput {
  readonly inviterUserId: UserId;
  readonly inviteeEmail: string;
  readonly householdId: HouseholdId;
}

export interface InviteToHouseholdOutput {
  readonly inviteUrl: string;
}

export interface LoginWithGoogleInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly state: string;
}

export interface LoginWithGoogleOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export interface LoginWithPasswordInput {
  readonly email: string;
  readonly password: string;
  readonly totp?: string;
}

export interface LoginWithPasswordOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export interface LogoutInput {
  readonly refreshToken: string;
}

export interface RefreshTokenInput {
  readonly refreshToken: string;
}

export interface RefreshTokenOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly locale?: LocaleCode;
}

export interface RegisterUserOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export interface RequestMagicLinkInput {
  readonly email: string;
}

export interface UpdateLocalePreferenceInput {
  readonly userId: UserId;
  readonly locale: LocaleCode;
}

export interface VerifyTotpInput {
  readonly userId: UserId;
  readonly code: string;
}
