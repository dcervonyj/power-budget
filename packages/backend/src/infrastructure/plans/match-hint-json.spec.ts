import { describe, it, expect } from 'vitest';
import type { PlannedItemMatchHint } from '@power-budget/core';
import { matchHintFromJson, matchHintToJson } from './match-hint-json.js';
import { plannedItemPatchFromJson, plannedItemPatchToJson } from './planned-item-version-json.js';

const FULL: PlannedItemMatchHint = {
  counterpartyPattern: 'Landlord',
  amount: { amountMinor: 340000n, toleranceMinor: 500n },
  day: { dayOfMonth: 5, window: 2 },
};

describe('match hint json', () => {
  it('round-trips a full hint with minor units as strings', () => {
    const json = matchHintToJson(FULL);

    expect(json).toEqual({
      counterpartyPattern: 'Landlord',
      amountMinor: '340000',
      toleranceMinor: '500',
      dayOfMonth: 5,
      dayWindow: 2,
    });
    expect(matchHintFromJson(json)).toEqual(FULL);
  });

  it('round-trips a counterparty-only hint', () => {
    const hint: PlannedItemMatchHint = { counterpartyPattern: 'Netflix', amount: null, day: null };

    expect(matchHintFromJson(matchHintToJson(hint))).toEqual(hint);
  });

  it('reads null and malformed values as no hint', () => {
    expect(matchHintToJson(null)).toBeNull();
    expect(matchHintFromJson(null)).toBeNull();
    expect(matchHintFromJson('x')).toBeNull();
    expect(matchHintFromJson({ amountMinor: '12.5', dayOfMonth: 'a' })).toBeNull();
  });
});

describe('planned item version json keeps the hint', () => {
  it('round-trips a changed hint and a cleared hint', () => {
    expect(plannedItemPatchFromJson(plannedItemPatchToJson({ matchHint: FULL }))).toEqual({
      matchHint: FULL,
    });
    expect(plannedItemPatchFromJson(plannedItemPatchToJson({ matchHint: null }))).toEqual({
      matchHint: null,
    });
  });

  it('leaves the hint out when the patch does not touch it', () => {
    expect(plannedItemPatchFromJson(plannedItemPatchToJson({ note: 'n' }))).toEqual({ note: 'n' });
  });
});
