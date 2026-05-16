import * as argon2 from 'argon2';
import type { PasswordHashing } from '../domain/ports.js';

export class Argon2PasswordHashing implements PasswordHashing {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash);
  }
}
