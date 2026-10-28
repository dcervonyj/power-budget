import { describe, expect, it } from 'vitest';
import { insertedRow } from './row-values.js';

describe('insertedRow', () => {
  it('returns the single returned row', () => {
    expect(insertedRow([{ id: 'a' }], 'thing')).toEqual({ id: 'a' });
  });

  it('throws when the insert returned no row', () => {
    expect(() => insertedRow([], 'thing')).toThrow('Insert of thing returned no row');
  });
});
