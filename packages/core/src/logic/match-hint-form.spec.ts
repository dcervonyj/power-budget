import { describe, expect, it } from 'vitest';
import {
  EMPTY_MATCH_HINT_FORM,
  matchHintToFormValues,
  parseMatchHintForm,
} from './match-hint-form.js';

describe('parseMatchHintForm', () => {
  it('reads an all-empty form as no hint', () => {
    expect(parseMatchHintForm(EMPTY_MATCH_HINT_FORM, 'PLN')).toEqual({ kind: 'empty' });
  });

  it('builds the wire hint in minor units', () => {
    const values = {
      counterpartyPattern: ' Landlord ',
      amount: '3000.00',
      tolerance: '50',
      dayOfMonth: '5',
      dayWindow: '2',
    };
    expect(parseMatchHintForm(values, 'PLN')).toEqual({
      kind: 'ok',
      hint: {
        counterpartyPattern: 'Landlord',
        amountMinor: '300000',
        toleranceMinor: '5000',
        dayOfMonth: 5,
        dayWindow: 2,
      },
    });
  });

  it('defaults the tolerance and window and drops them without their anchor', () => {
    expect(
      parseMatchHintForm({ ...EMPTY_MATCH_HINT_FORM, amount: '10', dayOfMonth: '1' }, 'PLN'),
    ).toEqual({
      kind: 'ok',
      hint: {
        counterpartyPattern: null,
        amountMinor: '1000',
        toleranceMinor: '0',
        dayOfMonth: 1,
        dayWindow: 0,
      },
    });
    expect(
      parseMatchHintForm({ ...EMPTY_MATCH_HINT_FORM, counterpartyPattern: 'x' }, 'PLN'),
    ).toEqual({
      kind: 'ok',
      hint: {
        counterpartyPattern: 'x',
        amountMinor: null,
        toleranceMinor: null,
        dayOfMonth: null,
        dayWindow: null,
      },
    });
  });

  it('names every invalid field', () => {
    const values = {
      counterpartyPattern: 'x'.repeat(101),
      amount: 'abc',
      tolerance: '1',
      dayOfMonth: '32',
      dayWindow: '16',
    };
    expect(parseMatchHintForm(values, 'PLN')).toEqual({
      kind: 'invalid',
      fields: ['counterpartyPattern', 'amount', 'dayOfMonth', 'dayWindow'],
    });
  });

  it('rejects a tolerance without an amount and a window without a day', () => {
    expect(
      parseMatchHintForm(
        { ...EMPTY_MATCH_HINT_FORM, counterpartyPattern: 'x', tolerance: '5' },
        'PLN',
      ),
    ).toEqual({ kind: 'invalid', fields: ['tolerance'] });
    expect(
      parseMatchHintForm(
        { ...EMPTY_MATCH_HINT_FORM, counterpartyPattern: 'x', dayWindow: '2' },
        'PLN',
      ),
    ).toEqual({ kind: 'invalid', fields: ['dayWindow'] });
  });

  it('rejects a negative amount', () => {
    expect(parseMatchHintForm({ ...EMPTY_MATCH_HINT_FORM, amount: '-5' }, 'PLN')).toEqual({
      kind: 'invalid',
      fields: ['amount'],
    });
  });
});

describe('matchHintToFormValues', () => {
  it('round-trips a stored hint into the form fields', () => {
    const hint = {
      counterpartyPattern: 'Landlord',
      amountMinor: '300050',
      toleranceMinor: '5000',
      dayOfMonth: 5,
      dayWindow: 2,
    };
    const form = matchHintToFormValues(hint, 'PLN');
    expect(form).toEqual({
      counterpartyPattern: 'Landlord',
      amount: '3000.50',
      tolerance: '50.00',
      dayOfMonth: '5',
      dayWindow: '2',
    });
    expect(parseMatchHintForm(form, 'PLN')).toEqual({ kind: 'ok', hint });
  });

  it('is empty for no hint', () => {
    expect(matchHintToFormValues(null, 'PLN')).toEqual(EMPTY_MATCH_HINT_FORM);
  });
});
