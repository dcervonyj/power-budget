import type { Transaction } from '../domain/transactions/entities.js';
import type { PlannedItemId } from '../domain/plans/ids.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { IsoDateTime } from '../domain/shared/ids.js';
import { normaliseText } from './normalise-transaction.js';

export interface PriorMapping {
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId;
  readonly merchantName: string | null;
  readonly description: string;
  readonly mappedAt: IsoDateTime;
}

function mostRecentPlannedItemId(matches: PriorMapping[]): PlannedItemId {
  return matches.reduce((best, m) => (m.mappedAt > best.mappedAt ? m : best)).plannedItemId;
}

/**
 * Suggest a PlannedItemId for an incoming transaction based on prior manual mappings.
 *
 * 1. Exact merchant name match (normalised) → most recent
 * 2. Fallback: description substring match (normalised, min 3 chars) → most recent
 * 3. null when no match
 */
export function applyMappingSuggestion(
  transaction: Transaction,
  priorMappings: readonly PriorMapping[],
): PlannedItemId | null {
  if (priorMappings.length === 0) return null;

  const normMerchant = transaction.merchantName ? normaliseText(transaction.merchantName) : null;
  const normDesc = normaliseText(transaction.description);

  // Step 1: Exact merchant name match
  if (normMerchant) {
    const merchantMatches = priorMappings.filter(
      (m) => m.merchantName !== null && normaliseText(m.merchantName) === normMerchant,
    );
    if (merchantMatches.length > 0) {
      return mostRecentPlannedItemId(merchantMatches);
    }
  }

  // Step 2: Description substring match
  const descMatches = priorMappings.filter((m) => {
    const priorDesc = normaliseText(m.description);
    return (
      (normDesc.length >= 3 && priorDesc.includes(normDesc)) ||
      (priorDesc.length >= 3 && normDesc.includes(priorDesc))
    );
  });

  if (descMatches.length > 0) {
    return mostRecentPlannedItemId(descMatches);
  }

  return null;
}
