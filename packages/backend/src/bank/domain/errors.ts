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
