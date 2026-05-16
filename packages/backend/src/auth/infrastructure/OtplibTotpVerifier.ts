import { generateSecret, generateURI, verifySync } from 'otplib';
import type { TotpVerifier } from '../domain/ports.js';

export class OtplibTotpVerifier implements TotpVerifier {
  generateSecret(label: string): { secret: string; otpauthUri: string } {
    const secret = generateSecret();
    const otpauthUri = generateURI({ issuer: 'PowerBudget', label, secret });
    return { secret, otpauthUri };
  }

  verify(secret: string, code: string, window = 1): boolean {
    // epochTolerance is in seconds; one TOTP step = 30 s
    const result = verifySync({ secret, token: code, epochTolerance: window * 30 });
    return result.valid;
  }
}
