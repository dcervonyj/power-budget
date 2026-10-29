import { describe, it, expect } from 'vitest';
import {
  defaultNewPlanDraft,
  hasNewPlanErrors,
  toCreatePlanDto,
  validateNewPlanDraft,
  weeklyEndDate,
  type NewPlanDraft,
} from './NewPlanDraft.js';

const VALID: NewPlanDraft = {
  name: ' October ',
  type: 'personal',
  periodKind: 'monthly',
  startDate: '2026-10-01',
  endDate: '',
  baseCurrency: 'PLN',
};

describe('defaultNewPlanDraft', () => {
  it('starts a personal monthly plan on the first of the month in the profile currency', () => {
    expect(defaultNewPlanDraft(new Date(2026, 9, 29), 'PLN')).toEqual({
      name: '',
      type: 'personal',
      periodKind: 'monthly',
      startDate: '2026-10-01',
      endDate: '',
      baseCurrency: 'PLN',
    });
  });

  it('falls back to EUR when the profile currency is not supported', () => {
    expect(defaultNewPlanDraft(new Date(2026, 9, 29), 'XXX').baseCurrency).toBe('EUR');
  });
});

describe('weeklyEndDate', () => {
  it('is the start plus six days, across a month end', () => {
    expect(weeklyEndDate('2026-10-27')).toBe('2026-11-02');
  });

  it('is empty without a valid start', () => {
    expect(weeklyEndDate('')).toBe('');
  });
});

describe('validateNewPlanDraft', () => {
  it('accepts a monthly draft', () => {
    expect(validateNewPlanDraft(VALID)).toEqual({});
  });

  it('requires a name', () => {
    expect(validateNewPlanDraft({ ...VALID, name: '   ' })).toEqual({ name: 'required' });
  });

  it('rejects a name over 255 characters', () => {
    expect(validateNewPlanDraft({ ...VALID, name: 'a'.repeat(256) })).toEqual({
      name: 'too_long',
    });
  });

  it('requires a start date', () => {
    expect(validateNewPlanDraft({ ...VALID, startDate: '' })).toEqual({ startDate: 'required' });
  });

  it('rejects an unsupported currency', () => {
    expect(validateNewPlanDraft({ ...VALID, baseCurrency: 'XXX' })).toEqual({
      baseCurrency: 'unsupported',
    });
  });

  it('needs no end date for a weekly plan', () => {
    expect(validateNewPlanDraft({ ...VALID, periodKind: 'weekly' })).toEqual({});
  });

  it('requires an end date for a custom plan', () => {
    expect(validateNewPlanDraft({ ...VALID, periodKind: 'custom' })).toEqual({
      endDate: 'required',
    });
  });

  it('requires the custom end to be after the start, not equal to it', () => {
    const custom: NewPlanDraft = { ...VALID, periodKind: 'custom' };

    expect(validateNewPlanDraft({ ...custom, endDate: '2026-09-30' })).toEqual({
      endDate: 'not_after_start',
    });
    expect(validateNewPlanDraft({ ...custom, endDate: '2026-10-01' })).toEqual({
      endDate: 'not_after_start',
    });
    expect(validateNewPlanDraft({ ...custom, endDate: '2026-10-02' })).toEqual({});
  });

  it('reports every invalid field together', () => {
    const errors = validateNewPlanDraft({ ...VALID, name: '', startDate: '', baseCurrency: '' });

    expect(hasNewPlanErrors(errors)).toBe(true);
    expect(Object.keys(errors)).toEqual(['name', 'startDate', 'baseCurrency']);
  });
});

describe('toCreatePlanDto', () => {
  it('omits the end for monthly and weekly so the API derives it', () => {
    const monthly = toCreatePlanDto(VALID);
    const weekly = toCreatePlanDto({ ...VALID, periodKind: 'weekly', endDate: '2026-12-31' });

    expect(monthly).toEqual({
      name: 'October',
      type: 'personal',
      periodKind: 'monthly',
      periodStart: '2026-10-01',
      baseCurrency: 'PLN',
    });
    expect(weekly).toEqual({ ...monthly, periodKind: 'weekly' });
  });

  it('sends the end of a custom plan and the household type', () => {
    expect(
      toCreatePlanDto({ ...VALID, type: 'household', periodKind: 'custom', endDate: '2026-10-15' }),
    ).toEqual({
      name: 'October',
      type: 'household',
      periodKind: 'custom',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
      baseCurrency: 'PLN',
    });
  });
});
