import { describe, expect, it } from 'vitest';
import { PlannedItemId } from '@power-budget/core';
import { mappingSourceOf } from './mapping-source.js';

const SUGGESTED = PlannedItemId.of('01890a5d-ac96-774b-bcce-b302099a8057');

describe('mappingSourceOf', () => {
  it.each(['manual', 'rule', 'ai'] as const)('returns the stored origin %s', (origin) => {
    expect(mappingSourceOf(origin, null)).toBe(origin);
    expect(mappingSourceOf(origin, SUGGESTED)).toBe(origin);
  });

  it('returns suggestion for an unmapped row with a suggested planned item', () => {
    expect(mappingSourceOf(null, SUGGESTED)).toBe('suggestion');
  });

  it('returns none for an unmapped row without a suggestion', () => {
    expect(mappingSourceOf(null, null)).toBe('none');
  });
});
