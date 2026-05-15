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
