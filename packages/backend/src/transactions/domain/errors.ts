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
