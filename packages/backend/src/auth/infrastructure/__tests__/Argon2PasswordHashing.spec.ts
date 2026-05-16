import { describe, it, expect } from 'vitest';
import { Argon2PasswordHashing } from '../Argon2PasswordHashing.js';

describe('Argon2PasswordHashing', () => {
  const hashing = new Argon2PasswordHashing();

  it('hash returns a non-empty string different from the original', async () => {
    const hash = await hashing.hash('mysecretpassword');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe('mysecretpassword');
  });

  it('hash produces a valid argon2 hash (starts with $argon2)', async () => {
    const hash = await hashing.hash('password123');
    expect(hash).toMatch(/^\$argon2/);
  });

  it('verify returns true for correct password', async () => {
    const hash = await hashing.hash('correct-password');
    const result = await hashing.verify('correct-password', hash);
    expect(result).toBe(true);
  });

  it('verify returns false for wrong password', async () => {
    const hash = await hashing.hash('correct-password');
    const result = await hashing.verify('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('verify returns false for malformed hash', async () => {
    const result = await hashing.verify('any-password', 'not-a-valid-hash');
    expect(result).toBe(false);
  });
});
