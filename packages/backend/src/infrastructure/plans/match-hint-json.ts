import type { PlannedItemMatchHint } from '@power-budget/core';

/** jsonb shape of `planned_items.match_hint`: bigint minor units as strings. */
export interface MatchHintJson {
  readonly counterpartyPattern: string | null;
  readonly amountMinor: string | null;
  readonly toleranceMinor: string | null;
  readonly dayOfMonth: number | null;
  readonly dayWindow: number | null;
}

export function matchHintToJson(hint: PlannedItemMatchHint | null): MatchHintJson | null {
  if (hint === null) {
    return null;
  }

  return {
    counterpartyPattern: hint.counterpartyPattern,
    amountMinor: hint.amount === null ? null : hint.amount.amountMinor.toString(),
    toleranceMinor: hint.amount === null ? null : hint.amount.toleranceMinor.toString(),
    dayOfMonth: hint.day === null ? null : hint.day.dayOfMonth,
    dayWindow: hint.day === null ? null : hint.day.window,
  };
}

/** Reads a stored hint; anything that is not a well-formed hint reads as no hint. */
export function matchHintFromJson(value: unknown): PlannedItemMatchHint | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const json: Partial<Record<keyof MatchHintJson, unknown>> = value;
  const counterpartyPattern =
    typeof json.counterpartyPattern === 'string' ? json.counterpartyPattern : null;
  const amount = readAmount(json.amountMinor, json.toleranceMinor);
  const day = readDay(json.dayOfMonth, json.dayWindow);
  if (counterpartyPattern === null && amount === null && day === null) {
    return null;
  }

  return { counterpartyPattern, amount, day };
}

function readAmount(amountMinor: unknown, toleranceMinor: unknown): PlannedItemMatchHint['amount'] {
  if (typeof amountMinor !== 'string' || !/^\d{1,18}$/.test(amountMinor)) {
    return null;
  }
  const tolerance =
    typeof toleranceMinor === 'string' && /^\d{1,18}$/.test(toleranceMinor) ? toleranceMinor : '0';

  return { amountMinor: BigInt(amountMinor), toleranceMinor: BigInt(tolerance) };
}

function readDay(dayOfMonth: unknown, dayWindow: unknown): PlannedItemMatchHint['day'] {
  if (typeof dayOfMonth !== 'number' || !Number.isInteger(dayOfMonth)) {
    return null;
  }
  const window = typeof dayWindow === 'number' && Number.isInteger(dayWindow) ? dayWindow : 0;

  return { dayOfMonth, window };
}
