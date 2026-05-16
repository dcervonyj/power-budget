import { describe, it, expect } from 'vitest';
import {
  InvalidCredentialsError,
  TotpRequiredError,
  TotpInvalidError,
  UserNotFoundError,
  EmailAlreadyRegisteredError,
  HouseholdNotFoundError,
  TotpEnrollmentRequiredError,
  InviteExpiredError,
  InviteAlreadyUsedError,
  AlreadyInHouseholdError,
} from '../errors.js';

describe('auth domain errors', () => {
  it('InvalidCredentialsError extends Error with correct message', () => {
    const err = new InvalidCredentialsError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('INVALID_CREDENTIALS');
    expect(err.name).toBe('InvalidCredentialsError');
  });

  it('TotpRequiredError has correct message and name', () => {
    const err = new TotpRequiredError();
    expect(err.message).toBe('TOTP_REQUIRED');
    expect(err.name).toBe('TotpRequiredError');
  });

  it('TotpInvalidError has correct message and name', () => {
    const err = new TotpInvalidError();
    expect(err.message).toBe('TOTP_INVALID');
    expect(err.name).toBe('TotpInvalidError');
  });

  it('UserNotFoundError has correct message', () => {
    const err = new UserNotFoundError();
    expect(err.message).toBe('USER_NOT_FOUND');
    expect(err.name).toBe('UserNotFoundError');
  });

  it('EmailAlreadyRegisteredError has correct message', () => {
    const err = new EmailAlreadyRegisteredError();
    expect(err.message).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('HouseholdNotFoundError has correct message', () => {
    const err = new HouseholdNotFoundError();
    expect(err.message).toBe('HOUSEHOLD_NOT_FOUND');
  });

  it('TotpEnrollmentRequiredError has code property', () => {
    const err = new TotpEnrollmentRequiredError();
    expect(err.code).toBe('requires_totp_enrollment');
    expect(err.name).toBe('TotpEnrollmentRequiredError');
  });

  it('InviteExpiredError has correct message', () => {
    const err = new InviteExpiredError();
    expect(err.message).toBe('INVITE_EXPIRED');
  });

  it('InviteAlreadyUsedError has correct message', () => {
    const err = new InviteAlreadyUsedError();
    expect(err.message).toBe('INVITE_ALREADY_USED');
  });

  it('AlreadyInHouseholdError has correct message', () => {
    const err = new AlreadyInHouseholdError();
    expect(err.message).toBe('ALREADY_IN_HOUSEHOLD');
  });
});
