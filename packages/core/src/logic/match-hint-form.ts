import { formatMoneyInput, parseMinorUnits, parseMoney } from './money-amount.js';
import {
  MATCH_HINT_MAX_DAY_WINDOW,
  MATCH_HINT_PATTERN_MAX_LENGTH,
} from '../domain/plans/match-hint.js';

/** The match hint as the API sends and accepts it (minor units as integer strings). */
export interface MatchHintWire {
  readonly counterpartyPattern?: string | null;
  readonly amountMinor?: string | null;
  readonly toleranceMinor?: string | null;
  readonly dayOfMonth?: number | null;
  readonly dayWindow?: number | null;
}

/** What a user typed into the match hint fields; amounts are major units ("3000.00"). */
export interface MatchHintFormValues {
  readonly counterpartyPattern: string;
  readonly amount: string;
  readonly tolerance: string;
  readonly dayOfMonth: string;
  readonly dayWindow: string;
}

export type MatchHintField = keyof MatchHintFormValues;

export type MatchHintFormResult =
  /** Every field is empty: send null to clear the hint (or no hint for a new item). */
  | { readonly kind: 'empty' }
  | { readonly kind: 'ok'; readonly hint: Required<MatchHintWire> }
  | { readonly kind: 'invalid'; readonly fields: readonly MatchHintField[] };

export const EMPTY_MATCH_HINT_FORM: MatchHintFormValues = {
  counterpartyPattern: '',
  amount: '',
  tolerance: '',
  dayOfMonth: '',
  dayWindow: '',
};

export function matchHintToFormValues(
  hint: MatchHintWire | null,
  currency: string,
): MatchHintFormValues {
  if (hint === null) {
    return EMPTY_MATCH_HINT_FORM;
  }

  return {
    counterpartyPattern: hint.counterpartyPattern ?? '',
    amount: minorToInput(hint.amountMinor, currency),
    tolerance: minorToInput(hint.toleranceMinor, currency),
    dayOfMonth:
      hint.dayOfMonth === null || hint.dayOfMonth === undefined ? '' : String(hint.dayOfMonth),
    dayWindow:
      hint.dayWindow === null || hint.dayWindow === undefined ? '' : String(hint.dayWindow),
  };
}

/** Validates the typed fields and builds the API hint. Tolerance needs an amount, window a day. */
export function parseMatchHintForm(
  values: MatchHintFormValues,
  currency: string,
): MatchHintFormResult {
  const pattern = values.counterpartyPattern.trim();
  const amount = values.amount.trim();
  const tolerance = values.tolerance.trim();
  const day = values.dayOfMonth.trim();
  const window = values.dayWindow.trim();
  if ([pattern, amount, tolerance, day, window].every((v) => v === '')) {
    return { kind: 'empty' };
  }

  const amountMinor = amount === '' ? null : majorToMinor(amount, currency);
  const toleranceMinor = tolerance === '' ? '0' : majorToMinor(tolerance, currency);
  const dayOfMonth = day === '' ? null : parseWhole(day, 1, 31);
  const dayWindow = window === '' ? 0 : parseWhole(window, 0, MATCH_HINT_MAX_DAY_WINDOW);

  const fields: MatchHintField[] = [];
  if (pattern.length > MATCH_HINT_PATTERN_MAX_LENGTH) {
    fields.push('counterpartyPattern');
  }
  if (amount !== '' && amountMinor === null) {
    fields.push('amount');
  }
  if (toleranceMinor === null || (tolerance !== '' && amount === '')) {
    fields.push('tolerance');
  }
  if (day !== '' && dayOfMonth === null) {
    fields.push('dayOfMonth');
  }
  if (dayWindow === null || (window !== '' && day === '')) {
    fields.push('dayWindow');
  }
  if (fields.length > 0 || toleranceMinor === null || dayWindow === null) {
    return { kind: 'invalid', fields };
  }
  if (pattern === '' && amountMinor === null && dayOfMonth === null) {
    return { kind: 'invalid', fields: ['counterpartyPattern'] };
  }

  return {
    kind: 'ok',
    hint: {
      counterpartyPattern: pattern === '' ? null : pattern,
      amountMinor,
      toleranceMinor: amountMinor === null ? null : toleranceMinor,
      dayOfMonth,
      dayWindow: dayOfMonth === null ? null : dayWindow,
    },
  };
}

function minorToInput(value: string | null | undefined, currency: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return formatMoneyInput(parseMinorUnits(value), currency);
  } catch {
    return '';
  }
}

function majorToMinor(value: string, currency: string): string | null {
  try {
    const minor = parseMoney(value, currency);

    return minor < 0n ? null : minor.toString();
  } catch {
    return null;
  }
}

function parseWhole(value: string, min: number, max: number): number | null {
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }
  const n = Number(value);

  return n >= min && n <= max ? n : null;
}
