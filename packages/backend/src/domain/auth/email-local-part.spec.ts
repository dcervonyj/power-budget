import { describe, it, expect } from 'vitest';
import { emailLocalPart } from './email-local-part.js';

describe('emailLocalPart', () => {
  it('returns the part before the @', () => {
    expect(emailLocalPart('anna@example.com')).toBe('anna');
  });

  it('returns the whole string when there is no @', () => {
    expect(emailLocalPart('anna')).toBe('anna');
  });

  it('returns the whole email when the local part is empty', () => {
    expect(emailLocalPart('@example.com')).toBe('@example.com');
  });
});
