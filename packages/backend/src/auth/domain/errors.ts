export class InvalidCredentialsError extends Error {
  constructor() {
    super('INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class TotpRequiredError extends Error {
  constructor() {
    super('TOTP_REQUIRED');
    this.name = 'TotpRequiredError';
  }
}

export class TotpInvalidError extends Error {
  constructor() {
    super('TOTP_INVALID');
    this.name = 'TotpInvalidError';
  }
}

export class MagicLinkExpiredError extends Error {
  constructor() {
    super('MAGIC_LINK_EXPIRED');
    this.name = 'MagicLinkExpiredError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InviteExpiredError extends Error {
  constructor() {
    super('INVITE_EXPIRED');
    this.name = 'InviteExpiredError';
  }
}

export class InviteAlreadyUsedError extends Error {
  constructor() {
    super('INVITE_ALREADY_USED');
    this.name = 'InviteAlreadyUsedError';
  }
}

export class EmailMismatchError extends Error {
  constructor() {
    super('EMAIL_MISMATCH');
    this.name = 'EmailMismatchError';
  }
}

export class AlreadyInHouseholdError extends Error {
  constructor() {
    super('ALREADY_IN_HOUSEHOLD');
    this.name = 'AlreadyInHouseholdError';
  }
}

export class TotpEnrollmentRequiredError extends Error {
  readonly code = 'requires_totp_enrollment';
  constructor() {
    super('TOTP enrollment required before connecting a bank account');
    this.name = 'TotpEnrollmentRequiredError';
  }
}

export class HouseholdNotFoundError extends Error {
  constructor() {
    super('HOUSEHOLD_NOT_FOUND');
    this.name = 'HouseholdNotFoundError';
  }
}
