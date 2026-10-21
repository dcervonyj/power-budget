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
  INVITE_NOT_FOUND: mapping(HttpStatus.NOT_FOUND, 'invite_not_found', 'Invite not found'),
  INVITE_SELF: mapping(HttpStatus.CONFLICT, 'invite_self', 'You cannot invite yourself'),
  HOUSEHOLD_FULL: mapping(
    HttpStatus.CONFLICT,
    'household_full',
    'The household already has two members',
  ),
  HOUSEHOLD_NOT_EMPTY: mapping(
    HttpStatus.CONFLICT,
    'household_not_empty',
    'Your own household already has data, so it cannot be left',
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
  INVALID_CURSOR: mapping(HttpStatus.BAD_REQUEST, 'invalid_cursor', 'Invalid pagination cursor'),
  // Tenancy checks (CLN-005): an id from another household reads as not found.
  BANK_ACCOUNT_NOT_FOUND: mapping(
    HttpStatus.NOT_FOUND,
    'bank_account_not_found',
    'Bank account not found',
  ),
  TRANSACTION_CURRENCY_MISMATCH: mapping(
    HttpStatus.BAD_REQUEST,
    'transaction_currency_mismatch',
    'The amount must be in the account currency',
  ),
  PLANNED_ITEM_NOT_FOUND: mapping(
    HttpStatus.NOT_FOUND,
    'planned_item_not_found',
    'Planned item not found',
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
    'An active plan of this type already overlaps this period',
  ),
  PLAN_ARCHIVED: mapping(HttpStatus.CONFLICT, 'plan_archived', 'Plan is archived'),
  PLAN_PERIOD_INVALID: mapping(
    HttpStatus.BAD_REQUEST,
    'plan_period_invalid',
    'Invalid plan period',
  ),
  CATEGORY_NOT_FOUND: mapping(HttpStatus.NOT_FOUND, 'category_not_found', 'Category not found'),
  CATEGORY_DUPLICATE: mapping(
    HttpStatus.CONFLICT,
    'category_duplicate',
    'An active category with this name already exists',
  ),
  CATEGORY_READ_ONLY: mapping(
    HttpStatus.FORBIDDEN,
    'category_read_only',
    'System categories cannot be changed',
  ),
  USER_PREFERENCE_INVALID: mapping(
    HttpStatus.BAD_REQUEST,
    'user_preference_invalid',
    'Invalid preference value',
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
