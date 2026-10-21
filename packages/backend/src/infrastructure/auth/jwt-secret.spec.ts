import { describe, it, expect } from 'vitest';
import { InvalidJwtSecretError, resolveJwtSecret } from './jwt-secret.js';

const STRONG = 'a'.repeat(32);

describe('resolveJwtSecret', () => {
  it.each(['production', 'staging', 'development', undefined])(
    'throws when JWT_SECRET is missing (NODE_ENV=%s)',
    (nodeEnv) => {
      expect(() => resolveJwtSecret(undefined, nodeEnv)).toThrow(InvalidJwtSecretError);
      expect(() => resolveJwtSecret('', nodeEnv)).toThrow(InvalidJwtSecretError);
    },
  );

  it('throws when JWT_SECRET is shorter than 32 bytes', () => {
    expect(() => resolveJwtSecret('a'.repeat(31), 'production')).toThrow(/shorter than 32 bytes/);
  });

  it('never accepts the old hard-coded default', () => {
    expect(() => resolveJwtSecret('dev-secret-change-me', 'staging')).toThrow(
      InvalidJwtSecretError,
    );
  });

  it('returns a secret of at least 32 bytes', () => {
    expect(resolveJwtSecret(STRONG, 'production')).toBe(STRONG);
  });

  it('only falls back to a test secret under NODE_ENV=test', () => {
    const secret = resolveJwtSecret(undefined, 'test');

    expect(secret).not.toBe('dev-secret-change-me');
    expect(Buffer.byteLength(secret)).toBeGreaterThanOrEqual(32);
  });
});
