import { describe, expect, it } from 'vitest';
import { InvalidCursorError } from '../../domain/transactions/errors.js';
import { decodeTransactionCursor, encodeTransactionCursor } from './transactionCursor.js';

const ID = '0197c0de-0000-7000-8000-000000000001';

describe('transaction cursor', () => {
  it('round-trips and is base64url', () => {
    const raw = encodeTransactionCursor({ occurredOn: '2026-10-01', id: ID });

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeTransactionCursor(raw)).toEqual({ occurredOn: '2026-10-01', id: ID });
  });

  it.each(['', '!!', ID, Buffer.from('a|b|c').toString('base64url')])('rejects %s', (raw) => {
    expect(() => decodeTransactionCursor(raw)).toThrow(InvalidCursorError);
  });

  it('rejects an impossible date', () => {
    const bad = Buffer.from(`9999-99-99|${ID}`).toString('base64url');

    expect(() => decodeTransactionCursor(bad)).toThrow(InvalidCursorError);
  });
});
