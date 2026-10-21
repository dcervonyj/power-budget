import { describe, it, expect } from 'vitest';
import { generateSync } from 'otplib';
import { OtplibTotpVerifier } from './OtplibTotpVerifier.js';

const PERIOD_SECONDS = 30;

function codeAt(secret: string, epochSeconds: number): string {
  return generateSync({ secret, epoch: epochSeconds });
}

describe('OtplibTotpVerifier', () => {
  const verifier = new OtplibTotpVerifier();
  const { secret } = verifier.generateSecret('alice@example.com');
  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / PERIOD_SECONDS);

  it('builds an otpauth URI for the PowerBudget issuer', () => {
    const { otpauthUri } = verifier.generateSecret('alice@example.com');

    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\/PowerBudget:alice%40example\.com\?/);
  });

  it('returns the matched time step for a current code', () => {
    expect(verifier.verify(secret, codeAt(secret, now), null)).toBe(currentStep);
  });

  it('accepts one step of clock drift', () => {
    expect(verifier.verify(secret, codeAt(secret, now - PERIOD_SECONDS), null)).toBe(
      currentStep - 1,
    );
  });

  it('rejects a code whose step is not after the last used step (replay)', () => {
    expect(verifier.verify(secret, codeAt(secret, now), currentStep)).toBeNull();
  });

  it('accepts the next step after the last used step', () => {
    expect(verifier.verify(secret, codeAt(secret, now + PERIOD_SECONDS), currentStep)).toBe(
      currentStep + 1,
    );
  });

  it('rejects a wrong code', () => {
    const code = codeAt(secret, now);
    const wrong = code === '000000' ? '111111' : '000000';

    expect(verifier.verify(secret, wrong, null)).toBeNull();
  });

  it('treats malformed input as a wrong code instead of throwing', () => {
    expect(verifier.verify(secret, 'abc', null)).toBeNull();
    expect(verifier.verify(secret, '', null)).toBeNull();
  });
});
