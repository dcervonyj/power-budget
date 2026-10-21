import { generateSecret, generateURI, verifySync } from 'otplib';
import type { TotpVerifier } from '../../domain/auth/ports.js';

/** One 30-second step of clock drift is tolerated either way. */
const EPOCH_TOLERANCE_SECONDS = 30;

export class OtplibTotpVerifier implements TotpVerifier {
  generateSecret(label: string): { secret: string; otpauthUri: string } {
    const secret = generateSecret();
    const otpauthUri = generateURI({ issuer: 'PowerBudget', label, secret });

    return { secret, otpauthUri };
  }

  verify(secret: string, code: string, afterTimeStep: number | null): number | null {
    try {
      const result = verifySync({
        secret,
        token: code,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
        ...(afterTimeStep !== null ? { afterTimeStep } : {}),
      });

      if (!result.valid || !('timeStep' in result)) {
        return null;
      }

      return result.timeStep;
    } catch {
      // otplib throws on malformed input (wrong length, non-digits): treat as a wrong code.
      return null;
    }
  }
}
