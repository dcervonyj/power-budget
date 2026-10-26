import { describe, expect, it } from 'vitest';
import { applyKeypadKey } from '../keypadInput.js';

describe('applyKeypadKey', () => {
  it('appends digits and drops a lone leading zero', () => {
    expect(applyKeypadKey('', '1')).toBe('1');
    expect(applyKeypadKey('0', '5')).toBe('5');
    expect(applyKeypadKey('12', '3')).toBe('123');
  });

  it('allows one separator and starts "0." from empty', () => {
    expect(applyKeypadKey('', '.')).toBe('0.');
    expect(applyKeypadKey('12', '.')).toBe('12.');
    expect(applyKeypadKey('12.5', '.')).toBe('12.5');
  });

  it('limits to two decimals and twelve characters', () => {
    expect(applyKeypadKey('1.25', '9')).toBe('1.25');
    expect(applyKeypadKey('123456789012', '3')).toBe('123456789012');
  });

  it('backspace removes the last character', () => {
    expect(applyKeypadKey('12.5', 'backspace')).toBe('12.');
    expect(applyKeypadKey('', 'backspace')).toBe('');
  });
});
