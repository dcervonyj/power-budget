import { describe, it, expect } from 'vitest';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConnectionAlreadyActiveError,
  BankConsentNotFoundError,
  BankConnectionInvalidStateError,
} from '../errors.js';

describe('bank domain errors', () => {
  it('BankConnectionNotFoundError has correct message and name', () => {
    const err = new BankConnectionNotFoundError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('BANK_CONNECTION_NOT_FOUND');
    expect(err.name).toBe('BankConnectionNotFoundError');
  });

  it('BankConnectionForbiddenError has correct message', () => {
    const err = new BankConnectionForbiddenError();
    expect(err.message).toBe('BANK_CONNECTION_FORBIDDEN');
    expect(err.name).toBe('BankConnectionForbiddenError');
  });

  it('BankConnectionAlreadyActiveError has correct message', () => {
    const err = new BankConnectionAlreadyActiveError();
    expect(err.message).toBe('BANK_CONNECTION_ALREADY_ACTIVE');
  });

  it('BankConsentNotFoundError has correct message', () => {
    const err = new BankConsentNotFoundError();
    expect(err.message).toBe('BANK_CONSENT_NOT_FOUND');
  });

  it('BankConnectionInvalidStateError accepts a custom message', () => {
    const err = new BankConnectionInvalidStateError('Connection is pending, cannot reconnect');
    expect(err.message).toBe('Connection is pending, cannot reconnect');
    expect(err.name).toBe('BankConnectionInvalidStateError');
  });
});
