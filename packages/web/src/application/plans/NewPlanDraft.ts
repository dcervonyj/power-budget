import { isSupportedCurrency, parseLocalIsoDate, toLocalIsoDate } from '@power-budget/core';
import type {
  CreatePlanDto,
  PlanPeriodKindDto,
  PlanTypeDto,
} from '@power-budget/shared-app/contract';

export const PLAN_NAME_MAX_LENGTH = 255;
export const DEFAULT_NEW_PLAN_CURRENCY = 'EUR';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_LAST_DAY_OFFSET = 6;

/** What the create-plan form holds while the user types. */
export interface NewPlanDraft {
  readonly name: string;
  readonly type: PlanTypeDto;
  readonly periodKind: PlanPeriodKindDto;
  readonly startDate: string;
  /** Only read for a custom period; weekly and monthly ends come from the start. */
  readonly endDate: string;
  readonly baseCurrency: string;
}

export type NewPlanNameError = 'required' | 'too_long';
export type NewPlanStartError = 'required';
export type NewPlanEndError = 'required' | 'not_after_start';
export type NewPlanCurrencyError = 'unsupported';

/** One entry per field with a problem; a missing key is a valid field. */
export interface NewPlanErrors {
  readonly name?: NewPlanNameError;
  readonly startDate?: NewPlanStartError;
  readonly endDate?: NewPlanEndError;
  readonly baseCurrency?: NewPlanCurrencyError;
}

/** A personal monthly plan starting on the first of the month of `today`. */
export function defaultNewPlanDraft(today: Date, profileCurrency: string): NewPlanDraft {
  return {
    name: '',
    type: 'personal',
    periodKind: 'monthly',
    startDate: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: '',
    baseCurrency: isSupportedCurrency(profileCurrency)
      ? profileCurrency
      : DEFAULT_NEW_PLAN_CURRENCY,
  };
}

/** The last day of a weekly plan: the start plus six days (the API derives the same). */
export function weeklyEndDate(startDate: string): string {
  if (!ISO_DATE.test(startDate)) {
    return '';
  }
  const start = parseLocalIsoDate(startDate);

  return toLocalIsoDate(
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + WEEK_LAST_DAY_OFFSET),
  );
}

/**
 * The last day of a monthly plan: one month after the start, minus a day, with the day
 * clamped to the length of that month (the API derives the same).
 */
export function monthlyEndDate(startDate: string): string {
  if (!ISO_DATE.test(startDate)) {
    return '';
  }
  const start = parseLocalIsoDate(startDate);
  const lastDayOfNextMonth = new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate();
  const day = Math.min(start.getDate(), lastDayOfNextMonth);

  return toLocalIsoDate(new Date(start.getFullYear(), start.getMonth() + 1, day - 1));
}

export function validateNewPlanDraft(draft: NewPlanDraft): NewPlanErrors {
  const name = draft.name.trim();
  const nameError: NewPlanErrors = name === '' ? { name: 'required' } : {};
  const nameLengthError: NewPlanErrors =
    name.length > PLAN_NAME_MAX_LENGTH ? { name: 'too_long' } : {};
  const startError: NewPlanErrors = ISO_DATE.test(draft.startDate) ? {} : { startDate: 'required' };
  const currencyError: NewPlanErrors = isSupportedCurrency(draft.baseCurrency)
    ? {}
    : { baseCurrency: 'unsupported' };

  return {
    ...nameError,
    ...nameLengthError,
    ...startError,
    ...currencyError,
    ...customEndError(draft),
  };
}

export function hasNewPlanErrors(errors: NewPlanErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The request body; weekly and monthly omit the end so the API derives it. */
export function toCreatePlanDto(draft: NewPlanDraft): CreatePlanDto {
  const base = {
    name: draft.name.trim(),
    type: draft.type,
    periodKind: draft.periodKind,
    periodStart: draft.startDate,
    baseCurrency: toApiCurrency(draft.baseCurrency),
  };

  return draft.periodKind === 'custom' ? { ...base, periodEnd: draft.endDate } : base;
}

function customEndError(draft: NewPlanDraft): NewPlanErrors {
  if (draft.periodKind !== 'custom') {
    return {};
  }
  if (!ISO_DATE.test(draft.endDate)) {
    return { endDate: 'required' };
  }
  // ISO dates compare correctly as strings.
  if (ISO_DATE.test(draft.startDate) && draft.endDate <= draft.startDate) {
    return { endDate: 'not_after_start' };
  }

  return {};
}

function toApiCurrency(code: string): CreatePlanDto['baseCurrency'] {
  if (!isSupportedCurrency(code)) {
    throw new Error(`Unsupported currency ${code}`);
  }

  return code;
}
