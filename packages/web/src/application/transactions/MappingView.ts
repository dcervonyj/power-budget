import type { MappedBy, Transaction } from '../../domain/transactions/Transaction.js';

/** What a list row is, read from the row itself (the list carries the mapping, CLN-023). */
export type MappingView =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'transfer' }
  /** `suggested`: the API proposes a planned item that waits for confirmation. */
  | { readonly kind: 'unmapped'; readonly suggested: boolean }
  | {
      readonly kind: 'mapped';
      readonly plannedItemId: string;
      /** Empty when unknown; the row then shows the plan name. */
      readonly categoryName: string;
      readonly planName: string;
      readonly planArchived: boolean;
      readonly by: MappedBy;
    };

/** Same priority as the API's `unmappedOnly`: ignored > transfer > mapped > unmapped. */
export function mappingViewOf(tx: Transaction): MappingView {
  if (tx.ignored) {
    return { kind: 'ignored' };
  }
  if (tx.isTransfer) {
    return { kind: 'transfer' };
  }
  if (tx.mapping === null) {
    return { kind: 'unmapped', suggested: tx.suggestedPlannedItemId !== null };
  }

  return {
    kind: 'mapped',
    plannedItemId: tx.mapping.plannedItemId,
    categoryName: tx.mapping.categoryName,
    planName: tx.mapping.planName,
    planArchived: tx.mapping.planArchived,
    by: tx.mapping.by,
  };
}
