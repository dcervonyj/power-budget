import { describe, expect, it } from 'vitest';
import { requireCategoryName, UnknownCategoryError } from './categoryName.js';

describe('requireCategoryName', () => {
  const names = new Map([['cat-1', 'Food']]);

  it('returns the name of a known category', () => {
    expect(requireCategoryName(names, 'cat-1')).toBe('Food');
  });

  it('throws a typed error carrying the id for a category the list lacks', () => {
    expect(() => requireCategoryName(names, 'cat-9')).toThrow(UnknownCategoryError);
    expect(() => requireCategoryName(names, 'cat-9')).toThrow('Unknown category cat-9');
  });
});
