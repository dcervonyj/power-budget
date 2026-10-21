export class TransactionNotFoundError extends Error {
  constructor() {
    super('TRANSACTION_NOT_FOUND');
    this.name = 'TransactionNotFoundError';
  }
}

export class AlreadyMappedError extends Error {
  constructor() {
    super('ALREADY_MAPPED');
    this.name = 'AlreadyMappedError';
  }
}

export class AlreadyTransferError extends Error {
  constructor() {
    super('ALREADY_TRANSFER');
    this.name = 'AlreadyTransferError';
  }
}

export class PlannedItemNotFoundError extends Error {
  constructor() {
    super('PLANNED_ITEM_NOT_FOUND');
    this.name = 'PlannedItemNotFoundError';
  }
}

export class BankAccountNotFoundError extends Error {
  constructor() {
    super('BANK_ACCOUNT_NOT_FOUND');
    this.name = 'BankAccountNotFoundError';
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super('INVALID_CURSOR');
    this.name = 'InvalidCursorError';
  }
}

export class TransactionCurrencyMismatchError extends Error {
  constructor() {
    super('TRANSACTION_CURRENCY_MISMATCH');
    this.name = 'TransactionCurrencyMismatchError';
  }
}
