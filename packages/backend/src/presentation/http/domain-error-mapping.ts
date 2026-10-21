import { HttpStatus } from '@nestjs/common';
import { TotpEnrollmentRequiredError } from '../../domain/auth/errors.js';
import { BankConnectionInvalidStateError } from '../../domain/bank/errors.js';

export interface HttpErrorMapping {
  readonly status: HttpStatus;
  /** Stable, lower snake case code clients branch on (body field `code`). */
  readonly code: string;
  readonly message: string;
}

/**
 * Domain/application errors keyed by their message code. Error classes use the
 * code as the whole message (`InvalidCredentialsError` -> `INVALID_CREDENTIALS`);
 * plain errors use it as a prefix (`PLAN_NOT_FOUND: Plan ... not found`). The
 * detail after the prefix is never sent to the client (audit H3).
 */
const BY_MESSAGE_CODE: Readonly<Record<string, HttpErrorMapping>> = {
  INVALID_CREDENTIALS: mapping(
    HttpStatus.UNAUTHORIZED,
    'invalid_credentials',
    'Invalid credentials',
  ),
  TOTP_REQUIRED: mapping(HttpStatus.FORBIDDEN, 'requires_totp', 'TOTP code required'),
  TOTP_INVALID: mapping(HttpStatus.UNAUTHORIZED, 'totp_invalid', 'Invalid TOTP code'),
  MAGIC_LINK_EXPIRED: mapping(
    HttpStatus.UNAUTHORIZED,
    'magic_link_expired',
    'Magic link is invalid or expired',
  ),
  USER_NOT_FOUND: mapping(HttpStatus.NOT_FOUND, 'user_not_found', 'User not found'),
  EMAIL_ALREADY_REGISTERED: mapping(
    HttpStatus.CONFLICT,
    'email_already_registered',
    'Email already registered',
  ),
  INVITE_EXPIRED: mapping(HttpStatus.GONE, 'invite_expired', 'Invite has expired'),
  INVITE_ALREADY_USED: mapping(
    HttpStatus.CONFLICT,
    'invite_already_used',
    'Invite has already been used',
  ),
  EMAIL_MISMATCH: mapping(
    HttpStatus.FORBIDDEN,
    'email_mismatch',
    'Invite was sent to another email address',
  ),
  ALREADY_IN_HOUSEHOLD: mapping(
    HttpStatus.CONFLICT,
    'already_in_household',
    'User already belongs to a household',
  ),
  MVP_SINGLE_HOUSEHOLD: mapping(
    HttpStatus.CONFLICT,
    'already_in_household',
    'User already belongs to a household',
  ),
  HOUSEHOLD_NOT_FOUND: mapping(HttpStatus.NOT_FOUND, 'household_not_found', 'Household not found'),
  HOUSEHOLD_OWNER_REQUIRED: mapping(
    HttpStatus.FORBIDDEN,
    'household_owner_required',
    'Only the household owner can do this',
  ),
  BANK_CONNECTION_NOT_FOUND: mapping(
    HttpStatus.NOT_FOUND,
    'bank_connection_not_found',
    'Connection not found',
  ),
  BANK_CONNECTION_FORBIDDEN: mapping(
    HttpStatus.FORBIDDEN,
    'bank_connection_forbidden',
    'Not your connection',
  ),
  BANK_CONNECTION_ALREADY_ACTIVE: mapping(
    HttpStatus.CONFLICT,
    'bank_connection_already_active',
    'Connection to this bank already exists',
  ),
  BANK_CONSENT_NOT_FOUND: mapping(
    HttpStatus.NOT_FOUND,
    'bank_consent_not_found',
    'Consent not found',
  ),
  TRANSACTION_NOT_FOUND: mapping(
    HttpStatus.NOT_FOUND,
    'transaction_not_found',
    'Transaction not found',
  ),
  ALREADY_MAPPED: mapping(HttpStatus.CONFLICT, 'already_mapped', 'Transaction is already mapped'),
  ALREADY_TRANSFER: mapping(
    HttpStatus.CONFLICT,
    'already_transfer',
    'Transaction is already a transfer',
  ),
  PLAN_NOT_FOUND: mapping(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found'),
  PLAN_DUPLICATE: mapping(
    HttpStatus.CONFLICT,
    'plan_duplicate',
    'An active plan of this type and period already exists',
  ),
  FX_RATE_UNAVAILABLE: mapping(
    HttpStatus.SERVICE_UNAVAILABLE,
    'fx_rate_unavailable',
    'Exchange rate unavailable',
  ),
};

const MESSAGE_CODE = /^([A-Z][A-Z0-9_]*)(?::|$)/;

/** Returns the HTTP mapping of a known domain error, or null for anything else (-> 500). */
export function mapDomainError(error: unknown): HttpErrorMapping | null {
  if (!(error instanceof Error)) {
    return null;
  }
  if (error instanceof TotpEnrollmentRequiredError) {
    return mapping(HttpStatus.FORBIDDEN, error.code, 'TOTP enrollment required');
  }
  if (error instanceof BankConnectionInvalidStateError) {
    return mapping(HttpStatus.CONFLICT, 'bank_connection_invalid_state', error.message);
  }

  const code = MESSAGE_CODE.exec(error.message)?.[1];

  return code !== undefined ? (BY_MESSAGE_CODE[code] ?? null) : null;
}

/** Fallback `code` for HTTP exceptions thrown without one. */
export function codeForStatus(status: number): string {
  const name = HttpStatus[status];

  return typeof name === 'string' ? name.toLowerCase() : 'error';
}

function mapping(status: HttpStatus, code: string, message: string): HttpErrorMapping {
  return { status, code, message };
}
