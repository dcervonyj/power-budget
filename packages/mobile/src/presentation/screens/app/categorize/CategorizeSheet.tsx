import React from 'react';
import { CategorizeSheetView } from './CategorizeSheetView.js';
import type { CategoryChoice, Ledger, Payment } from './categorizeModel.js';
import { useCategorizeSession } from './useCategorizeSession.js';
import type { LoadStatus, SheetState } from './useToSort.js';

export interface CategorizeSheetProps {
  readonly sheet: SheetState;
  readonly choices: readonly CategoryChoice[];
  readonly choicesStatus: LoadStatus;
  readonly choicesStale: boolean;
  readonly ledger: Ledger;
  readonly onRetryChoices: () => void;
  readonly busyIds: Set<string>;
  readonly write: (transactionId: string, plannedItemId: string | null) => Promise<void>;
  readonly onConfirmed: (payment: Payment, plannedItemId: string) => void;
  readonly onUndone: (transactionId: string) => void;
  readonly onClose: () => void;
  readonly onBackToTransactions?: () => void;
}

/** Owns one pass over the unsorted payments. Mount it with `key={sheet.key}` so each open starts fresh. */
export function CategorizeSheet(props: CategorizeSheetProps): React.JSX.Element {
  const session = useCategorizeSession({
    queue: props.sheet.queue,
    startIndex: props.sheet.startIndex,
    choices: props.choices,
    ledger: props.ledger,
    write: props.write,
    busyIds: props.busyIds,
    onConfirmed: props.onConfirmed,
    onUndone: props.onUndone,
  });

  return (
    <CategorizeSheetView
      isOpen={props.sheet.isOpen}
      onClose={props.onClose}
      session={session}
      choicesStatus={props.choicesStatus}
      choicesStale={props.choicesStale}
      onRetryChoices={props.onRetryChoices}
      onBackToTransactions={props.onBackToTransactions}
    />
  );
}
