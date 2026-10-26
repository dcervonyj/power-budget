/**
 * `enable_banking` is the bank-feed provider from plan-banking.md §1.10. `gocardless` and
 * `wise_personal` stay until BNK-008 and WISE-005 retire them.
 */
export type BankProvider = 'enable_banking' | 'gocardless' | 'wise_personal';

export type ConsentLifecycle = 'pending' | 'active' | 'expiring' | 'expired' | 'disconnected';

/**
 * Status of one transaction as the bank reports it (plan-banking.md §1.7):
 * Enable Banking `BOOK` → booked, `PDNG`/`HOLD` → pending, `CNCL`/`RJCT` → cancelled,
 * `SCHD` → scheduled, `OTHR` → other.
 */
export const BANK_TX_STATUSES = ['booked', 'pending', 'cancelled', 'scheduled', 'other'] as const;
export type BankTxStatus = (typeof BANK_TX_STATUSES)[number];

/** Which side of the account a transaction moves: money in (credit) or money out (debit). */
export const BANK_TX_DIRECTIONS = ['credit', 'debit'] as const;
export type BankTxDirection = (typeof BANK_TX_DIRECTIONS)[number];

/**
 * Status of a bank consent as the provider reports it (plan-banking.md §1.6).
 * Enable Banking session `AUTHORIZED` → active, `PENDING_AUTHORIZATION` → pending_authorization,
 * `EXPIRED` → expired, `REVOKED` → revoked, `CLOSED` → closed, `CANCELLED`/`INVALID` → failed.
 */
export const BANK_CONSENT_STATUSES = [
  'pending_authorization',
  'active',
  'expired',
  'revoked',
  'closed',
  'failed',
] as const;
export type BankConsentStatus = (typeof BANK_CONSENT_STATUSES)[number];
