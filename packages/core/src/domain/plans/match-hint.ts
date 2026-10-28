/**
 * AI-004: how a planned item recognises the bank transaction that pays it.
 * Amounts are minor units of the planned item's currency. At least one part is set.
 */
export interface PlannedItemMatchHint {
  /** Case/diacritic-insensitive text that must appear in the merchant, counterparty or description. */
  readonly counterpartyPattern: string | null;
  /** Expected amount, plus or minus the tolerance (both minor units, tolerance >= 0). */
  readonly amount: { readonly amountMinor: bigint; readonly toleranceMinor: bigint } | null;
  /** Expected day of month, plus or minus the window in days (month ends clamp, months wrap). */
  readonly day: { readonly dayOfMonth: number; readonly window: number } | null;
}

export const MATCH_HINT_PATTERN_MAX_LENGTH = 100;
export const MATCH_HINT_MAX_DAY_WINDOW = 15;
