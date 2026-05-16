import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankProvider, BankId, CountryCode } from '../../domain/entities.js';

export interface ScheduledSyncTarget {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
}

export interface CompleteBankConsentInput {
  readonly externalConsentRef: string;
  readonly callbackPayload: Record<string, string>;
}

export interface CompleteBankConsentOutput {
  readonly connectionId: BankConnectionId;
}

export interface DisconnectBankInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

export interface GetBankCatalogInput {
  readonly country: CountryCode;
}

export interface InitiateBankConnectionInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly provider: BankProvider;
  readonly bankId: BankId;
  readonly redirectUri: string;
}

export interface InitiateBankConnectionOutput {
  readonly consentUrl: string;
  readonly connectionId: BankConnectionId;
}

export interface ReconnectBankInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly redirectUri: string;
}

export interface ReconnectBankOutput {
  readonly consentUrl: string;
}

export interface RefreshConnectionInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

export interface RefreshConnectionOutput {
  readonly jobId: string | null;
}
