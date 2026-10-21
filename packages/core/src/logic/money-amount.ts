import { CURRENCIES, isSupportedCurrency } from '../domain/shared/currency.js';
import { InvalidMoneyAmountError } from '../domain/shared/errors.js';

const MINOR_UNITS_PATTERN = /^-?\d+$/;
const DECIMAL_PATTERN = /^(\d*)(?:\.(\d*))?$/;
const GROUPING_CHARACTERS = /[\s  '_]/g;
const MINUS_SIGNS = /^[-−]/;

/**
 * Number of minor-unit digits of a currency (PLN 2, JPY 0, KWD 3).
 * Supported currencies use the core table; any other ISO 4217 code falls back to
 * the exponent that Intl knows for it.
 */
export function getMinorUnitExponent(currency: string): number {
  if (isSupportedCurrency(currency)) {
    return CURRENCIES[currency].minorUnitExponent;
  }

  return intlExponent(currency);
}

/**
 * Parse user input in major units ("12,50", "-1 200.5", "1500") into exact minor
 * units of the currency. Never goes through a float. Rejects more fraction digits
 * than the currency has instead of rounding them away.
 */
export function parseMoney(input: string, currency: string): bigint {
  const exponent = getMinorUnitExponent(currency);
  const compact = input.trim().replace(GROUPING_CHARACTERS, '');
  const negative = MINUS_SIGNS.test(compact);
  const unsigned = compact.replace(MINUS_SIGNS, '').replace(/^\+/, '');
  const match = DECIMAL_PATTERN.exec(normaliseDecimalSeparator(unsigned));
  if (!match) {
    throw new InvalidMoneyAmountError(input, 'not a number');
  }
  const whole = match[1] ?? '';
  const fraction = match[2] ?? '';
  if (whole === '' && fraction === '') {
    throw new InvalidMoneyAmountError(input, 'not a number');
  }
  if (fraction.length > exponent) {
    throw new InvalidMoneyAmountError(input, `${currency} allows ${exponent} decimal places`);
  }
  const minor = BigInt(`${whole || '0'}${fraction.padEnd(exponent, '0')}`);

  return negative ? -minor : minor;
}

/**
 * Parse a minor-unit amount as sent by the API (an integer string, CLN-002).
 */
export function parseMinorUnits(wire: string): bigint {
  if (!MINOR_UNITS_PATTERN.test(wire)) {
    throw new InvalidMoneyAmountError(wire, 'not an integer amount in minor units');
  }

  return BigInt(wire);
}

/**
 * Format minor units as a plain major-unit number for an input field
 * (no grouping, no symbol): 123450n PLN -> "1234.50", 1500n JPY -> "1500".
 */
export function formatMoneyInput(amountMinor: bigint, currency: string): string {
  const exponent = getMinorUnitExponent(currency);
  const negative = amountMinor < 0n;
  const digits = (negative ? -amountMinor : amountMinor).toString().padStart(exponent + 1, '0');
  const sign = negative ? '-' : '';
  if (exponent === 0) {
    return `${sign}${digits}`;
  }

  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

function normaliseDecimalSeparator(value: string): string {
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma === -1) {
    return value;
  }
  if (lastDot === -1) {
    // Only commas: a single comma is the decimal separator (pl, uk, ru input),
    // several commas are thousands separators.
    return value.split(',').length === 2 ? value.replace(',', '.') : value.replace(/,/g, '');
  }
  // Both present: the last one is the decimal separator, the other one groups.
  if (lastComma > lastDot) {
    return value.replace(/\./g, '').replace(',', '.');
  }

  return value.replace(/,/g, '');
}

function intlExponent(currency: string): number {
  const digits = intlCurrencyOptions(currency).maximumFractionDigits;
  if (digits === undefined) {
    throw new InvalidMoneyAmountError(currency, 'unknown currency');
  }

  return digits;
}

function intlCurrencyOptions(currency: string): Intl.ResolvedNumberFormatOptions {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions();
  } catch {
    throw new InvalidMoneyAmountError(currency, 'unknown currency');
  }
}
