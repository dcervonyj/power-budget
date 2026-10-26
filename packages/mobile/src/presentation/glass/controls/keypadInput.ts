export type KeypadKey =
  'backspace' | '.' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

const MAX_DECIMALS = 2;
const MAX_LENGTH = 12;

/** Applies one key press to an amount string ("" | "12" | "12.5"), always dot-separated. */
export function applyKeypadKey(value: string, key: KeypadKey): string {
  if (key === 'backspace') {
    return value.slice(0, -1);
  }
  if (key === '.') {
    return applySeparator(value);
  }

  return applyDigit(value, key);
}

function applySeparator(value: string): string {
  if (value.includes('.')) {
    return value;
  }

  return value === '' ? '0.' : `${value}.`;
}

function applyDigit(value: string, digit: string): string {
  if (value.length >= MAX_LENGTH) {
    return value;
  }
  const dot = value.indexOf('.');
  if (dot !== -1 && value.length - dot > MAX_DECIMALS) {
    return value;
  }
  if (value === '0') {
    return digit;
  }

  return `${value}${digit}`;
}
