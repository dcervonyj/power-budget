import type { Brand } from './ids.js';

export type EncryptedString = Brand<string, 'EncryptedString'>;

/**
 * The one place a plain string becomes an `EncryptedString`. Only the encryption adapter and bank connectors
 * that mint a consent token call it; an encrypted payload has no format to validate here.
 */
export const EncryptedString = {
  of(raw: string): EncryptedString {
    return raw as EncryptedString;
  },
};
