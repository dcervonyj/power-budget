import { InvalidCursorError } from '../../domain/transactions/errors.js';

export interface TransactionCursor {
  readonly occurredOn: string;
  readonly id: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** base64url, plus the padded standard base64 the unplanned reader issued before CLN-043. */
const CURSOR_CHARS = /^(?:[A-Za-z0-9_-]+|[A-Za-z0-9+/]+={0,2})$/;

/** Opaque keyset cursor for the `(occurredOn DESC, id DESC)` order, base64url of `occurredOn|id`. */
export function encodeTransactionCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.occurredOn}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeTransactionCursor(raw: string): TransactionCursor {
  if (!CURSOR_CHARS.test(raw)) {
    throw new InvalidCursorError();
  }
  const [occurredOn, id, ...rest] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !occurredOn || !id || !DATE.test(occurredOn) || !UUID.test(id)) {
    throw new InvalidCursorError();
  }
  const parsed = new Date(`${occurredOn}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 over to March, so compare the round trip.
  // Postgres `date` has no year 0 (the regex already caps the year at 9999).
  if (
    occurredOn.startsWith('0000') ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== occurredOn
  ) {
    throw new InvalidCursorError();
  }

  return { occurredOn, id };
}
