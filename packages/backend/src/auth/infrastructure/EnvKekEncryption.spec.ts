import { describe, it, expect } from 'vitest';
import { EnvKekEncryption } from './EnvKekEncryption.js';

// A valid 32-byte key (base64-encoded)
const VALID_KEK = Buffer.alloc(32, 0x42).toString('base64'); // 32 bytes of 0x42

describe('EnvKekEncryption', () => {
  it('encrypts and decrypts a round-trip', async () => {
    const enc = new EnvKekEncryption(VALID_KEK);
    const plaintext = 'super secret value';
    const ciphertext = await enc.encrypt(plaintext);
    const decrypted = await enc.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext (random IV)', async () => {
    const enc = new EnvKekEncryption(VALID_KEK);
    const ct1 = await enc.encrypt('same text');
    const ct2 = await enc.encrypt('same text');

    expect(ct1).not.toBe(ct2);
  });

  it('ciphertext format is kid:alg:iv:data:tag', async () => {
    const enc = new EnvKekEncryption(VALID_KEK);
    const ct = await enc.encrypt('hello');
    const parts = ct.split(':');

    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('env-v1');
    expect(parts[1]).toBe('aes-256-gcm');
  });

  it('throws on wrong key', async () => {
    const enc1 = new EnvKekEncryption(VALID_KEK);
    const ct = await enc1.encrypt('secret');

    const wrongKey = Buffer.alloc(32, 0x99).toString('base64');
    const enc2 = new EnvKekEncryption(wrongKey);

    await expect(enc2.decrypt(ct)).rejects.toThrow();
  });

  it('throws on tampered ciphertext', async () => {
    const enc = new EnvKekEncryption(VALID_KEK);
    const ct = await enc.encrypt('secret');
    const tampered = (ct.slice(0, -2) + 'ZZ') as typeof ct;

    await expect(enc.decrypt(tampered)).rejects.toThrow();
  });

  it('throws if KEK is wrong size', () => {
    const shortKey = Buffer.alloc(16, 0x42).toString('base64');
    expect(() => new EnvKekEncryption(shortKey)).toThrow('KEK must be 32 bytes');
  });
});
