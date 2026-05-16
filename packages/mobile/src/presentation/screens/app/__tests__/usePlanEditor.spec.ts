import { describe, it, expect, vi } from 'vitest';

// react-native uses Flow syntax which Rollup cannot parse; mock the whole module
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('react-intl', () => ({
  useIntl: vi.fn(),
}));

vi.mock('../../../../infrastructure/index.js', () => ({
  planService: {
    getPlan: vi.fn(),
    listPlannedItems: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    createPlannedItem: vi.fn(),
    updatePlannedItem: vi.fn(),
    deletePlannedItem: vi.fn(),
    archivePlan: vi.fn(),
  },
}));

import { todayIso, endOfMonthIso, formatAmount, parseAmount } from '../usePlanEditor.js';

// These pure utility functions exported from usePlanEditor can be tested
// without a React environment or any mocking.

describe('usePlanEditor utilities (mobile)', () => {
  describe('todayIso', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = todayIso();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a date equal to today', () => {
      const result = todayIso();
      const today = new Date().toISOString().slice(0, 10);
      expect(result).toBe(today);
    });
  });

  describe('endOfMonthIso', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = endOfMonthIso();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a date on or after today', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(endOfMonthIso() >= today).toBe(true);
    });
  });

  describe('formatAmount', () => {
    it('converts minor units to decimal string', () => {
      expect(formatAmount(10000)).toBe('100.00');
    });

    it('handles zero', () => {
      expect(formatAmount(0)).toBe('0.00');
    });

    it('handles odd cents', () => {
      expect(formatAmount(123)).toBe('1.23');
    });

    it('handles negative values', () => {
      expect(formatAmount(-500)).toBe('-5.00');
    });
  });

  describe('parseAmount', () => {
    it('converts decimal string to minor units', () => {
      expect(parseAmount('100.00')).toBe(10000);
    });

    it('rounds to nearest minor unit', () => {
      expect(parseAmount('1.23')).toBe(123);
    });

    it('returns 0 for NaN input', () => {
      expect(parseAmount('abc')).toBe(0);
    });

    it('returns 0 for empty string', () => {
      expect(parseAmount('')).toBe(0);
    });

    it('handles integer input', () => {
      expect(parseAmount('5')).toBe(500);
    });
  });
});
