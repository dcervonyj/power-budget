import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { EncryptedString } from '@power-budget/core';
import type { Encryption } from '../../domain/auth/ports.js';

const KID = 'env-v1';
const ALG = 'aes-256-gcm';
const IV_BYTES = 16;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;

/**
 * AES-256-GCM envelope encryption using a Key Encryption Key (KEK) from the environment.
 * Ciphertext format: `{kid}:{alg}:{iv_b64}:{ciphertext_b64}:{authtag_b64}`
 *
 * AwsKmsEncryption adapter is deferred until INF-009 (Fly.io/cloud provisioning).
 */
export class EnvKekEncryption implements Encryption {
  private readonly keyBuffer: Buffer;

  constructor(kek: string) {
    const decoded = Buffer.from(kek, 'base64');
    if (decoded.length !== KEY_BYTES) {
      throw new Error(
        `EnvKekEncryption: KEK must be ${KEY_BYTES} bytes (base64-encoded). Got ${decoded.length} bytes.`,
      );
    }
    this.keyBuffer = decoded;
  }

  async encrypt(plaintext: string): Promise<EncryptedString> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALG, this.keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const result = [
      KID,
      ALG,
      iv.toString('base64'),
      encrypted.toString('base64'),
      authTag.toString('base64'),
    ].join(':');

    return result as EncryptedString;
  }

  async decrypt(ciphertext: EncryptedString): Promise<string> {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) {
      throw new Error('EnvKekEncryption: invalid ciphertext format');
    }
    const [kid, alg, ivB64, ciphertextB64, authTagB64] = parts;
    if (kid !== KID || alg !== ALG) {
      throw new Error(`EnvKekEncryption: unsupported kid="${kid}" alg="${alg}"`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(ciphertextB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    if (authTag.length !== AUTH_TAG_BYTES) {
      throw new Error('EnvKekEncryption: invalid auth tag length');
    }

    const decipher = createDecipheriv(ALG, this.keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }
}
