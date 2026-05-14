import { describe, it, expect } from 'vitest';
import { Money } from '../src/domain/shared/money.js';
import { CurrencyMismatchError } from '../src/domain/shared/errors.js';

describe('Money', () => {
  describe('of', () => {
    it('creates a Money instance', () => {
      const m = Money.of(1234n, 'PLN');
      expect(m.amountMinor).toBe(1234n);
      expect(m.currency).toBe('PLN');
    });
  });

  describe('zero', () => {
    it('creates a zero Money instance', () => {
      const m = Money.zero('EUR');
      expect(m.amountMinor).toBe(0n);
      expect(m.currency).toBe('EUR');
    });
  });

  describe('isZero', () => {
    it('returns true for zero', () => {
      expect(Money.isZero(Money.zero('PLN'))).toBe(true);
    });

    it('returns false for non-zero', () => {
      expect(Money.isZero(Money.of(1n, 'PLN'))).toBe(false);
    });
  });

  describe('add', () => {
    it('adds same-currency amounts', () => {
      const result = Money.add(Money.of(1234n, 'PLN'), Money.of(1n, 'PLN'));
      expect(result.amountMinor).toBe(1235n);
      expect(result.currency).toBe('PLN');
    });

    it('throws CurrencyMismatchError for different currencies', () => {
      expect(() => Money.add(Money.of(100n, 'PLN'), Money.of(100n, 'EUR'))).toThrow(
        CurrencyMismatchError,
      );
    });
  });

  describe('sub', () => {
    it('subtracts same-currency amounts', () => {
      const result = Money.sub(Money.of(1000n, 'USD'), Money.of(300n, 'USD'));
      expect(result.amountMinor).toBe(700n);
    });

    it('throws CurrencyMismatchError for different currencies', () => {
      expect(() => Money.sub(Money.of(100n, 'USD'), Money.of(50n, 'GBP'))).toThrow(
        CurrencyMismatchError,
      );
    });
  });

  describe('negate', () => {
    it('negates positive amount', () => {
      expect(Money.negate(Money.of(500n, 'EUR')).amountMinor).toBe(-500n);
    });

    it('negates negative amount', () => {
      expect(Money.negate(Money.of(-200n, 'EUR')).amountMinor).toBe(200n);
    });

    it('preserves currency', () => {
      expect(Money.negate(Money.of(1n, 'GBP')).currency).toBe('GBP');
    });
  });

  describe('multiply', () => {
    it('multiplies by a bigint factor', () => {
      const result = Money.multiply(Money.of(100n, 'PLN'), 3n);
      expect(result.amountMinor).toBe(300n);
    });

    it('multiplies by zero', () => {
      const result = Money.multiply(Money.of(500n, 'PLN'), 0n);
      expect(result.amountMinor).toBe(0n);
    });

    it('preserves currency', () => {
      expect(Money.multiply(Money.of(10n, 'CHF'), 2n).currency).toBe('CHF');
    });
  });

  describe('equals', () => {
    it('returns true for equal amounts and currencies', () => {
      expect(Money.equals(Money.of(100n, 'PLN'), Money.of(100n, 'PLN'))).toBe(true);
    });

    it('returns false for different amounts', () => {
      expect(Money.equals(Money.of(100n, 'PLN'), Money.of(101n, 'PLN'))).toBe(false);
    });

    it('returns false for different currencies', () => {
      expect(Money.equals(Money.of(100n, 'PLN'), Money.of(100n, 'EUR'))).toBe(false);
    });
  });

  describe('compare', () => {
    it('returns -1 when a < b', () => {
      expect(Money.compare(Money.of(50n, 'USD'), Money.of(100n, 'USD'))).toBe(-1);
    });

    it('returns 0 when a === b', () => {
      expect(Money.compare(Money.of(100n, 'USD'), Money.of(100n, 'USD'))).toBe(0);
    });

    it('returns 1 when a > b', () => {
      expect(Money.compare(Money.of(200n, 'USD'), Money.of(100n, 'USD'))).toBe(1);
    });

    it('throws CurrencyMismatchError for different currencies', () => {
      expect(() => Money.compare(Money.of(100n, 'PLN'), Money.of(100n, 'USD'))).toThrow(
        CurrencyMismatchError,
      );
    });
  });

  describe('assertSameCurrency', () => {
    it('does not throw for same currency', () => {
      expect(() =>
        Money.assertSameCurrency(Money.of(1n, 'PLN'), Money.of(2n, 'PLN')),
      ).not.toThrow();
    });

    it('throws CurrencyMismatchError for different currencies', () => {
      expect(() => Money.assertSameCurrency(Money.of(1n, 'PLN'), Money.of(1n, 'EUR'))).toThrow(
        CurrencyMismatchError,
      );
    });
  });
});
