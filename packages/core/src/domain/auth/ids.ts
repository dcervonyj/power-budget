import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type UserId = Brand<string, 'UserId'>;
export const UserId = defineId('UserId');

export type HouseholdId = Brand<string, 'HouseholdId'>;
export const HouseholdId = defineId('HouseholdId');

export type HouseholdMemberId = Brand<string, 'HouseholdMemberId'>;
export const HouseholdMemberId = defineId('HouseholdMemberId');

export type SessionId = Brand<string, 'SessionId'>;
export const SessionId = defineId('SessionId');

export type AuthMethodId = Brand<string, 'AuthMethodId'>;
export const AuthMethodId = defineId('AuthMethodId');

export type TotpSecretId = Brand<string, 'TotpSecretId'>;
export const TotpSecretId = defineId('TotpSecretId');

export type HouseholdInviteId = Brand<string, 'HouseholdInviteId'>;
export const HouseholdInviteId = defineId('HouseholdInviteId');

export type MagicLinkTokenId = Brand<string, 'MagicLinkTokenId'>;
export const MagicLinkTokenId = defineId('MagicLinkTokenId');
