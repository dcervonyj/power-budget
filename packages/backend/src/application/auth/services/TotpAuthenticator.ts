import type { UserId } from '@power-budget/core';
import type {
  Encryption,
  TotpSecretRepository,
  TotpStepUpStore,
  TotpVerifier,
} from '../../../domain/auth/ports.js';
import type { User } from '../../../domain/auth/entities.js';
import {
  TotpEnrollmentRequiredError,
  TotpInvalidError,
  TotpRequiredError,
} from '../../../domain/auth/errors.js';

export interface TotpEnrolment {
  readonly qrCodeUri: string;
  readonly secret: string;
}

/**
 * Every TOTP operation goes through here (CLN-004):
 * - the secret is stored only as ciphertext from the Encryption port (audit H5),
 *   bound to the user via the encryption context;
 * - every accepted code claims its time step atomically, so a code is never
 *   accepted twice (audit M9);
 * - an accepted code stamps the step-up window used by @RequireRecentTotp.
 */
export class TotpAuthenticator {
  constructor(
    private readonly totpSecretRepo: TotpSecretRepository,
    private readonly totpVerifier: TotpVerifier,
    private readonly encryption: Encryption,
    private readonly stepUpStore: TotpStepUpStore,
  ) {}

  /** True once the user confirmed an enrolment with a valid code. */
  async isEnabled(userId: UserId): Promise<boolean> {
    const secret = await this.totpSecretRepo.findByUser(userId);

    return secret !== null && secret.verifiedAt !== null;
  }

  /**
   * Starts (or restarts) enrolment. The first enrolment needs no step-up
   * (audit C7: requiring one was a deadlock); replacing an enabled TOTP needs
   * a recent TOTP verification.
   */
  async enrol(user: User): Promise<TotpEnrolment> {
    if ((await this.isEnabled(user.id)) && !(await this.stepUpStore.isRecent(user.id))) {
      throw new TotpRequiredError();
    }

    const { secret, otpauthUri } = this.totpVerifier.generateSecret(user.email);
    await this.totpSecretRepo.save({
      userId: user.id,
      encryptedSecret: await this.encryption.encrypt(secret, contextFor(user.id)),
      enrolledAt: new Date(),
      verifiedAt: null,
      lastUsedTimeStep: null,
    });

    return { qrCodeUri: otpauthUri, secret };
  }

  /**
   * Verifies a code: confirms a pending enrolment, or proves possession for a
   * login or a step-up. Throws TotpInvalidError for a wrong or replayed code.
   */
  async verify(userId: UserId, code: string): Promise<void> {
    const stored = await this.totpSecretRepo.findByUser(userId);
    if (stored === null) {
      throw new TotpEnrollmentRequiredError();
    }

    const secret = await this.encryption.decrypt(stored.encryptedSecret, contextFor(userId));
    const timeStep = this.totpVerifier.verify(secret, code, stored.lastUsedTimeStep);
    if (timeStep === null) {
      throw new TotpInvalidError();
    }

    // A concurrent request may have used the same code a moment ago.
    const claimed = await this.totpSecretRepo.claimTimeStep(userId, timeStep, new Date());
    if (!claimed) {
      throw new TotpInvalidError();
    }

    await this.stepUpStore.stamp(userId);
  }
}

function contextFor(userId: UserId): string {
  return `totp:${userId}`;
}
