import { InvalidCursorError } from '../../domain/transactions/errors.js';

export interface TransactionCursor {
  readonly occurredOn: string;
  readonly id: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Opaque keyset cursor for the `(occurredOn DESC, id DESC)` order, base64url of `occurredOn|id`. */
export function encodeTransactionCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.occurredOn}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeTransactionCursor(raw: string): TransactionCursor {
  if (!BASE64URL.test(raw)) {
    throw new InvalidCursorError();
  }
  const [occurredOn, id, ...rest] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !occurredOn || !id || !DATE.test(occurredOn) || !UUID.test(id)) {
    throw new InvalidCursorError();
  }
  if (Number.isNaN(Date.parse(`${occurredOn}T00:00:00Z`))) {
    throw new InvalidCursorError();
  }

  return { occurredOn, id };
}
