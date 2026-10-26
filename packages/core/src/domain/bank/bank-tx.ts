import { BANK_CONSENT_STATUSES, BANK_TX_STATUSES } from './enums.js';
import type { BankConsentStatus, BankTxDirection, BankTxStatus } from './enums.js';

export function isBankTxStatus(value: string): value is BankTxStatus {
  return BANK_TX_STATUSES.some((status) => status === value);
}

export function isBankConsentStatus(value: string): value is BankConsentStatus {
  return BANK_CONSENT_STATUSES.some((status) => status === value);
}

/** The direction of a signed amount in minor units: negative is a debit, zero or more a credit. */
export function bankTxDirectionOf(amountMinor: bigint): BankTxDirection {
  return amountMinor < 0n ? 'debit' : 'credit';
}
