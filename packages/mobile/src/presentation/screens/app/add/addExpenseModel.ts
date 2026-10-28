import type { MinorUnitAmount } from '@power-budget/core';
import type { AccountDto } from '@power-budget/shared-app/contract';

/** The expense side of the plan the new expense lands in (Q4: the current period only). */
export interface PlanSnapshot {
  readonly planName: string;
  readonly currency: string;
  readonly plannedMinor: bigint;
  /** Mapped plus unplanned expenses so far. */
  readonly spentMinor: bigint;
  /** Days left in the period, today included. */
  readonly daysLeft: number;
}

/** One category chip. `plannedItemId` is null for the unplanned bucket (no plan line, no mapping). */
export interface CategoryOption {
  readonly id: string;
  readonly plannedItemId: string | null;
  readonly name: string;
  readonly plannedMinor: bigint;
  readonly spentMinor: bigint;
}

export interface AccountOption {
  readonly id: string;
  readonly name: string;
  readonly currency: AccountDto['currency'];
}

export type CategoryLineKind = 'under' | 'crossing' | 'alreadyOver' | 'unplanned';

/** What the typed amount does to safe to spend and to the chosen category (all exact minor units). */
export interface AddImpact {
  readonly safeBefore: MinorUnitAmount;
  readonly safeAfter: MinorUnitAmount;
  /** Plan left after the expense; negative when the expense takes the month over the plan. */
  readonly leftAfter: MinorUnitAmount;
  /** Share of the plan still left after the expense, 0..1 (the lens light). */
  readonly fraction: number;
  /** How far past the plan the expense takes the month, 0 when it stays within. */
  readonly overPlanMinor: bigint;
  readonly category: {
    readonly kind: CategoryLineKind;
    readonly before: MinorUnitAmount;
    readonly after: MinorUnitAmount;
    readonly fraction: number;
    readonly state: 'under' | 'over' | 'empty';
  };
}

export type AddExpenseStatus = 'editing' | 'saving' | 'saved';
