import type { PlannedItemId } from '../domain/plans/ids.js';
import type { PlannedDirection } from '../domain/plans/enums.js';
import type { PlannedItemMatchHint } from '../domain/plans/match-hint.js';
import type { Money } from '../domain/shared/money.js';
import type { IsoDate } from '../domain/shared/ids.js';
import { normaliseText } from './normalise-transaction.js';

/** A unique hint match at or above this confidence is mapped without asking. */
export const HINT_AUTO_MAP_CONFIDENCE = 0.95;
/** A match that is not unique never reaches the auto-map threshold. */
export const HINT_AMBIGUOUS_CONFIDENCE_CAP = 0.9;

export interface HintCandidate {
  readonly plannedItemId: PlannedItemId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly matchHint: PlannedItemMatchHint;
}

export interface HintTransaction {
  readonly direction: PlannedDirection;
  /** Magnitude; the sign is ignored (direction carries it). */
  readonly amount: Money;
  readonly occurredOn: IsoDate;
  readonly description: string;
  readonly merchant: string | null;
  readonly counterparty: string | null;
}

export interface HintMatch {
  readonly plannedItemId: PlannedItemId;
  /** 0..1, three decimals. */
  readonly confidence: number;
  /** True only for a unique match with confidence >= HINT_AUTO_MAP_CONFIDENCE. */
  readonly autoMap: boolean;
  /** How many planned items matched their hint. */
  readonly matchCount: number;
}

/** Confidence by the set of hint parts that were set and all matched: counterparty, amount, day. */
const CONFIDENCE: Readonly<Record<string, number>> = {
  'counterparty+amount+day': 0.99,
  'counterparty+amount': 0.97,
  'counterparty+day': 0.93,
  counterparty: 0.9,
  'amount+day': 0.8,
  amount: 0.6,
  day: 0.4,
};

/**
 * Score planned items against a transaction by their match hints. Every part a hint sets must
 * match. Returns the best match, or null when no hint matches. Two or more matching items give a
 * suggestion (confidence capped), never an auto-map.
 */
export function matchPlannedItemHints(
  transaction: HintTransaction,
  candidates: readonly HintCandidate[],
): HintMatch | null {
  const scored = candidates.flatMap((c) => scoreCandidate(transaction, c));
  if (scored.length === 0) {
    return null;
  }
  const best = scored.reduce(pickBetter);
  const unique = scored.length === 1;
  const confidence = unique
    ? best.confidence
    : Math.min(best.confidence, HINT_AMBIGUOUS_CONFIDENCE_CAP);

  return {
    plannedItemId: best.plannedItemId,
    confidence,
    autoMap: unique && confidence >= HINT_AUTO_MAP_CONFIDENCE,
    matchCount: scored.length,
  };
}

interface Scored {
  readonly plannedItemId: PlannedItemId;
  readonly confidence: number;
}

function pickBetter(a: Scored, b: Scored): Scored {
  if (b.confidence !== a.confidence) {
    return b.confidence > a.confidence ? b : a;
  }

  return b.plannedItemId < a.plannedItemId ? b : a;
}

function scoreCandidate(tx: HintTransaction, candidate: HintCandidate): Scored[] {
  const { matchHint: hint } = candidate;
  if (candidate.direction !== tx.direction) {
    return [];
  }
  const parts: string[] = [];
  if (hint.counterpartyPattern !== null) {
    if (!counterpartyMatches(tx, hint.counterpartyPattern)) {
      return [];
    }
    parts.push('counterparty');
  }
  if (hint.amount !== null) {
    if (!amountMatches(tx.amount, candidate.amount.currency, hint.amount)) {
      return [];
    }
    parts.push('amount');
  }
  if (hint.day !== null) {
    if (!dayMatches(tx.occurredOn, hint.day.dayOfMonth, hint.day.window)) {
      return [];
    }
    parts.push('day');
  }
  const confidence = CONFIDENCE[parts.join('+')];
  if (confidence === undefined) {
    return [];
  }

  return [{ plannedItemId: candidate.plannedItemId, confidence }];
}

function counterpartyMatches(tx: HintTransaction, pattern: string): boolean {
  const needle = normaliseText(pattern);
  if (needle === '') {
    return false;
  }

  return [tx.merchant, tx.counterparty, tx.description].some((field) =>
    includesNormalised(field, needle),
  );
}

function includesNormalised(field: string | null, needle: string): boolean {
  return field !== null && normaliseText(field).includes(needle);
}

function amountMatches(
  actual: Money,
  currency: string,
  expected: { readonly amountMinor: bigint; readonly toleranceMinor: bigint },
): boolean {
  if (actual.currency !== currency) {
    return false;
  }
  const magnitude = actual.amountMinor < 0n ? -actual.amountMinor : actual.amountMinor;
  const diff = magnitude - expected.amountMinor;

  return (diff < 0n ? -diff : diff) <= expected.toleranceMinor;
}

function dayMatches(occurredOn: IsoDate, dayOfMonth: number, window: number): boolean {
  const [year, month, day] = occurredOn.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  return [-1, 0, 1].some((offset) => {
    const expected = clampedDay(year, month + offset, dayOfMonth);

    return Math.abs(dayIndex(year, month, day) - expected) <= window;
  });
}

/** Days since a fixed epoch for a (possibly out-of-range) month, with the day clamped to the month. */
function clampedDay(year: number, month: number, dayOfMonth: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return dayIndex(year, month, Math.min(dayOfMonth, lastDay));
}

function dayIndex(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}
