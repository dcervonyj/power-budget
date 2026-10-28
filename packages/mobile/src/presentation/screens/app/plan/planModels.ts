import type { PlannedItemDirectionDto } from '@power-budget/shared-app/contract';

/** One planned item as the editor shows it. */
export interface PlanItemRowModel {
  readonly id: string;
  readonly name: string;
  readonly direction: PlannedItemDirectionDto;
  readonly amountMinor: string;
  readonly currency: string;
  /** The amount in major units for the input ("3000.00"). */
  readonly amountInput: string;
  /** Spent so far, in the plan currency; null when the dashboard is not available. */
  readonly spentMinor: bigint | null;
}

/** What the user typed into the new-item form. */
export interface PlanDraftItem {
  readonly categoryId: string;
  readonly direction: PlannedItemDirectionDto;
  readonly amount: string;
}

export interface PlanItemHandlers {
  /** The new exact amount (integer minor-unit string) of an item. */
  readonly onAmountChange: (id: string, amountMinor: string) => void;
  readonly onRemove: (id: string) => void;
}
