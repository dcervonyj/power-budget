import { describe, it, expect } from 'vitest';
import { TransactionNotFoundError, AlreadyMappedError, AlreadyTransferError } from '../errors.js';

describe('transaction domain errors', () => {
  it('TransactionNotFoundError has correct message and name', () => {
    const err = new TransactionNotFoundError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('TRANSACTION_NOT_FOUND');
    expect(err.name).toBe('TransactionNotFoundError');
  });

  it('AlreadyMappedError has correct message', () => {
    const err = new AlreadyMappedError();
    expect(err.message).toBe('ALREADY_MAPPED');
    expect(err.name).toBe('AlreadyMappedError');
  });

  it('AlreadyTransferError has correct message', () => {
    const err = new AlreadyTransferError();
    expect(err.message).toBe('ALREADY_TRANSFER');
    expect(err.name).toBe('AlreadyTransferError');
  });
});
