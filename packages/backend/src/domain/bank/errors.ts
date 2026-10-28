export class BankConnectionNotFoundError extends Error {
  constructor() {
    super('BANK_CONNECTION_NOT_FOUND');
    this.name = 'BankConnectionNotFoundError';
  }
}

export class BankConnectionForbiddenError extends Error {
  constructor() {
    super('BANK_CONNECTION_FORBIDDEN');
    this.name = 'BankConnectionForbiddenError';
  }
}

export class BankConnectionAlreadyActiveError extends Error {
  constructor() {
    super('BANK_CONNECTION_ALREADY_ACTIVE');
    this.name = 'BankConnectionAlreadyActiveError';
  }
}

export class BankConsentNotFoundError extends Error {
  constructor() {
    super('BANK_CONSENT_NOT_FOUND');
    this.name = 'BankConsentNotFoundError';
  }
}

export class BankConnectionInvalidStateError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BankConnectionInvalidStateError';
  }
}

// ── BankConnector failures (plan-banking.md §1.9) ────────────────────────────

export type BankConnectorErrorCode =
  | 'rate_limited'
  | 'consent_ended'
  | 'psu_context'
  | 'consent_flow'
  | 'transient'
  | 'provider_auth'
  | 'provider_data';

/** Base of the failures a BankConnector reports; switch on `code` via `isBankConnectorFailure`. */
export abstract class BankConnectorError extends Error {
  abstract readonly code: BankConnectorErrorCode;
}

/** 429 or `ASPSP_RATE_LIMIT_EXCEEDED`: the account cools down; no retry. */
export class BankRateLimitedError extends BankConnectorError {
  readonly code = 'rate_limited';

  /** `retryAfter`: the provider's hint (`Retry-After`), null when it gives none. */
  constructor(readonly retryAfter: Date | null) {
    super('BANK_RATE_LIMITED');
    this.name = 'BankRateLimitedError';
  }
}

export type BankConsentEndReason = 'expired' | 'revoked' | 'closed';

/** `EXPIRED_SESSION`, `REVOKED_SESSION`, `CLOSED_SESSION`: the owner must consent again. */
export class BankConsentEndedError extends BankConnectorError {
  readonly code = 'consent_ended';

  constructor(readonly reason: BankConsentEndReason) {
    super(`BANK_CONSENT_ENDED: ${reason}`);
    this.name = 'BankConsentEndedError';
  }
}

export type BankPsuContextProblem = 'missing' | 'invalid';

/** `PSU_HEADER_NOT_PROVIDED`, `PSU_HEADER_INVALID`: the PSU headers did not suit the bank. */
export class BankPsuContextError extends BankConnectorError {
  readonly code = 'psu_context';

  constructor(readonly problem: BankPsuContextProblem) {
    super(`BANK_PSU_CONTEXT: ${problem}`);
    this.name = 'BankPsuContextError';
  }
}

export type BankConsentFlowProblem = 'expired_authorization_code' | 'wrong_session_status';

/** `EXPIRED_AUTHORIZATION_CODE`, `WRONG_SESSION_STATUS`: the consent redirect must start again. */
export class BankConsentFlowError extends BankConnectorError {
  readonly code = 'consent_flow';

  constructor(readonly problem: BankConsentFlowProblem) {
    super(`BANK_CONSENT_FLOW: ${problem}`);
    this.name = 'BankConsentFlowError';
  }
}

/** 5xx, timeout or network failure: the job backs off and the next slot picks it up. */
export class BankTransientError extends BankConnectorError {
  readonly code = 'transient';

  constructor(readonly detail: string) {
    super(`BANK_TRANSIENT: ${detail}`);
    this.name = 'BankTransientError';
  }
}

/** 401 from the provider itself (bad JWT or app credentials): all syncs pause. */
export class BankProviderAuthError extends BankConnectorError {
  readonly code = 'provider_auth';

  constructor() {
    super('BANK_PROVIDER_AUTH');
    this.name = 'BankProviderAuthError';
  }
}

/** The provider answered, but without a value the sync cannot do without (an account with no currency). Retrying cannot fix it. */
export class BankProviderDataError extends BankConnectorError {
  readonly code = 'provider_data';

  constructor(readonly detail: string) {
    super(`BANK_PROVIDER_DATA: ${detail}`);
    this.name = 'BankProviderDataError';
  }
}

export type BankConnectorFailure =
  | BankRateLimitedError
  | BankConsentEndedError
  | BankPsuContextError
  | BankConsentFlowError
  | BankTransientError
  | BankProviderAuthError
  | BankProviderDataError;

/** Narrows an unknown error to the BankConnector failures, discriminated by `code`. */
export function isBankConnectorFailure(error: unknown): error is BankConnectorFailure {
  return error instanceof BankConnectorError;
}
