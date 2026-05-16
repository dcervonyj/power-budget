import type { IngestHashInput } from './entities.js';
import { createHash } from 'node:crypto';

/**
 * Computes the idempotency key for a bank transaction.
 *
 * Per ARCHITECTURE.md §5.3.1:
 * - If externalId is present: key = `${accountId}:${externalId}` (use it directly)
 * - If externalId is absent: key = SHA-256 hash of (account, date, amount, normalised description)
 */
export class IdempotentIngest {
  static normaliseDescription(description: string): string {
    return description
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\u0400-\u04FF\s]/g, ''); // keep Cyrillic
  }

  static computeHashKey(input: IngestHashInput): string {
    const raw = [
      input.accountId,
      input.occurredOn,
      input.amountMinor.toString(),
      input.currency.toLowerCase(),
      IdempotentIngest.normaliseDescription(input.normalisedDescription),
    ].join('|');
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  /**
   * Returns the external_id to store:
   * - If externalId provided: return as-is
   * - If null: compute deterministic hash key
   */
  static resolveExternalId(externalId: string | null, hashInput: IngestHashInput): string {
    return externalId ?? IdempotentIngest.computeHashKey(hashInput);
  }
}
