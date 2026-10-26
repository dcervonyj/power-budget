import { describe, it, expect } from 'vitest';
import {
  BANK_CONSENT_STATUSES,
  BANK_TX_STATUSES,
  bankTxDirectionOf,
  isBankConsentStatus,
  isBankTxStatus,
} from '../src/domain/bank/index.js';

describe('isBankTxStatus', () => {
  it('accepts every bank transaction status', () => {
    expect(BANK_TX_STATUSES.filter((status) => isBankTxStatus(status))).toEqual([
      'booked',
      'pending',
      'cancelled',
      'scheduled',
      'other',
    ]);
  });

  it('rejects provider codes and unknown values', () => {
    expect(isBankTxStatus('BOOK')).toBe(false);
    expect(isBankTxStatus('PDNG')).toBe(false);
    expect(isBankTxStatus('')).toBe(false);
    expect(isBankTxStatus('live')).toBe(false);
  });
});

describe('isBankConsentStatus', () => {
  it('accepts every consent status', () => {
    expect(BANK_CONSENT_STATUSES.filter((status) => isBankConsentStatus(status))).toEqual([
      'pending_authorization',
      'active',
      'expired',
      'revoked',
      'closed',
      'failed',
    ]);
  });

  it('rejects provider codes and unknown values', () => {
    expect(isBankConsentStatus('AUTHORIZED')).toBe(false);
    expect(isBankConsentStatus('reauth_required')).toBe(false);
  });
});

describe('bankTxDirectionOf', () => {
  it('reads a negative amount as a debit', () => {
    expect(bankTxDirectionOf(-1n)).toBe('debit');
    expect(bankTxDirectionOf(-4250n)).toBe('debit');
  });

  it('reads zero and positive amounts as a credit', () => {
    expect(bankTxDirectionOf(0n)).toBe('credit');
    expect(bankTxDirectionOf(100000n)).toBe('credit');
  });
});
