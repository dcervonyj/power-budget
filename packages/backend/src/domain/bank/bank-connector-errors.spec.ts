import { describe, it, expect } from 'vitest';
import {
  BankConsentEndedError,
  BankConsentFlowError,
  BankConnectionNotFoundError,
  BankProviderAuthError,
  BankProviderDataError,
  BankPsuContextError,
  BankRateLimitedError,
  BankTransientError,
  isBankConnectorFailure,
} from './errors.js';
import type { BankConnectorFailure } from './errors.js';

describe('BankConnector errors', () => {
  it('carries the code, the name and the details of each failure', () => {
    const retryAfter = new Date('2026-10-26T18:00:00Z');

    expect(new BankRateLimitedError(retryAfter)).toMatchObject({
      code: 'rate_limited',
      name: 'BankRateLimitedError',
      retryAfter,
    });
    expect(new BankConsentEndedError('revoked')).toMatchObject({
      code: 'consent_ended',
      name: 'BankConsentEndedError',
      reason: 'revoked',
      message: 'BANK_CONSENT_ENDED: revoked',
    });
    expect(new BankPsuContextError('missing')).toMatchObject({
      code: 'psu_context',
      problem: 'missing',
    });
    expect(new BankConsentFlowError('expired_authorization_code')).toMatchObject({
      code: 'consent_flow',
      problem: 'expired_authorization_code',
    });
    expect(new BankTransientError('HTTP 503')).toMatchObject({
      code: 'transient',
      detail: 'HTTP 503',
    });
    expect(new BankProviderAuthError()).toMatchObject({
      code: 'provider_auth',
      message: 'BANK_PROVIDER_AUTH',
    });
    expect(new BankProviderDataError('no currency')).toMatchObject({
      code: 'provider_data',
      name: 'BankProviderDataError',
      detail: 'no currency',
      message: 'BANK_PROVIDER_DATA: no currency',
    });
  });

  it('recognises the connector failures and nothing else', () => {
    expect(isBankConnectorFailure(new BankRateLimitedError(null))).toBe(true);
    expect(isBankConnectorFailure(new BankTransientError('timeout'))).toBe(true);
    expect(isBankConnectorFailure(new BankConnectionNotFoundError())).toBe(false);
    expect(isBankConnectorFailure(new Error('boom'))).toBe(false);
    expect(isBankConnectorFailure('boom')).toBe(false);
  });

  it('narrows to a union a sync job can switch on exhaustively', () => {
    const failures: unknown[] = [
      new BankRateLimitedError(null),
      new BankConsentEndedError('expired'),
      new BankPsuContextError('invalid'),
      new BankConsentFlowError('wrong_session_status'),
      new BankTransientError('timeout'),
      new BankProviderAuthError(),
      new BankProviderDataError('no currency'),
      new Error('not a connector failure'),
    ];

    expect(failures.map((failure) => effectOf(failure))).toEqual([
      'cooldown',
      'reauth_required',
      'retry_unattended',
      'restart_consent',
      'backoff',
      'pause_all',
      'fail_without_retry',
      'unknown',
    ]);
  });
});

function effectOf(error: unknown): string {
  if (!isBankConnectorFailure(error)) {
    return 'unknown';
  }

  return effectOfFailure(error);
}

function effectOfFailure(failure: BankConnectorFailure): string {
  switch (failure.code) {
    case 'rate_limited':
      return 'cooldown';
    case 'consent_ended':
      return 'reauth_required';
    case 'psu_context':
      return 'retry_unattended';
    case 'consent_flow':
      return 'restart_consent';
    case 'transient':
      return 'backoff';
    case 'provider_auth':
      return 'pause_all';
    case 'provider_data':
      return 'fail_without_retry';
    default: {
      const unreachable: never = failure;
      throw new Error(`Unknown failure ${String(unreachable)}`);
    }
  }
}
