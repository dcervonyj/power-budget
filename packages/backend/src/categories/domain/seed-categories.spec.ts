import { describe, it, expect } from 'vitest';
import { SEED_CATEGORIES } from './seed-categories.js';

describe('SEED_CATEGORIES', () => {
  it('has exactly 11 categories', () => {
    expect(SEED_CATEGORIES).toHaveLength(11);
  });

  it('all have unique seedKeys', () => {
    const keys = SEED_CATEGORIES.map((c) => c.seedKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all have names in all 4 locales', () => {
    for (const cat of SEED_CATEGORIES) {
      expect(cat.names.en).toBeTruthy();
      expect(cat.names.uk).toBeTruthy();
      expect(cat.names.ru).toBeTruthy();
      expect(cat.names.pl).toBeTruthy();
    }
  });

  it('income/expense split: 3 income + 8 expense', () => {
    const income = SEED_CATEGORIES.filter((c) => c.kind === 'income');
    const expense = SEED_CATEGORIES.filter((c) => c.kind === 'expense');
    expect(income).toHaveLength(3);
    expect(expense).toHaveLength(8);
  });

  it('all have icon and color set', () => {
    for (const cat of SEED_CATEGORIES) {
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
