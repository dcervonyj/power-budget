import { describe, it, expect } from 'vitest';
import { OtplibTotpVerifier } from '../OtplibTotpVerifier.js';
import { generateSync } from 'otplib';

describe('OtplibTotpVerifier', () => {
  const verifier = new OtplibTotpVerifier();

  it('generateSecret returns a non-empty secret and otpauthUri', () => {
    const { secret, otpauthUri } = verifier.generateSecret('test@example.com');
    expect(secret.length).toBeGreaterThan(0);
    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(otpauthUri).toContain('PowerBudget');
  });

  it('verifies a valid TOTP code generated from the secret', () => {
    const { secret } = verifier.generateSecret('user@example.com');
    const validCode = generateSync({ secret });
    expect(verifier.verify(secret, validCode)).toBe(true);
  });

  it('rejects an invalid TOTP code', () => {
    const { secret } = verifier.generateSecret('user@example.com');
    expect(verifier.verify(secret, '000000')).toBe(false);
  });

  it('rejects a non-existent TOTP code', () => {
    const { secret } = verifier.generateSecret('user@example.com');
    expect(verifier.verify(secret, '000000')).toBe(false);
  });
});
