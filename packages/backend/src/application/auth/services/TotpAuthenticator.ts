import type { EncryptedString, UserId } from '@power-budget/core';
import type {
  Encryption,
  TotpSecretRepository,
  TotpStepUpStore,
  TotpVerifier,
} from '../../../domain/auth/ports.js';
import type { TotpSecret, User } from '../../../domain/auth/entities.js';
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
 * - an accepted code stamps the step-up window used by @RequireRecentTotp;
 * - a replacement waits as a pending secret and is swapped in by its first
 *   valid code, so replacing TOTP never switches 2FA off (CLN-032).
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
   * a recent TOTP verification and only stores a pending secret, so 2FA stays
   * on with the active secret until the new one is confirmed (BE-BUGS-01).
   */
  async enrol(user: User): Promise<TotpEnrolment> {
    const enabled = await this.isEnabled(user.id);
    if (enabled && !(await this.stepUpStore.isRecent(user.id))) {
      throw new TotpRequiredError();
    }

    const { secret, otpauthUri } = this.totpVerifier.generateSecret(user.email);
    const encryptedSecret = await this.encryption.encrypt(secret, contextFor(user.id));
    if (enabled) {
      await this.totpSecretRepo.savePending(user.id, encryptedSecret);
    } else {
      await this.totpSecretRepo.save({
        userId: user.id,
        encryptedSecret,
        enrolledAt: new Date(),
        verifiedAt: null,
        lastUsedTimeStep: null,
        pendingEncryptedSecret: null,
      });
    }

    return { qrCodeUri: otpauthUri, secret };
  }

  /**
   * Proves possession of the active secret for a login or a step-up (a
   * pending replacement is never accepted here). Throws TotpInvalidError for
   * a wrong or replayed code.
   */
  async verify(userId: UserId, code: string): Promise<void> {
    const stored = await this.findEnrolment(userId);
    await this.verifyActive(stored, code);
  }

  /**
   * The code from `POST /auth/totp/verify`: the first valid code of a pending
   * replacement swaps it in atomically; any other code is checked against the
   * active secret (confirming a first enrolment or refreshing the step-up).
   */
  async confirm(userId: UserId, code: string): Promise<void> {
    const stored = await this.findEnrolment(userId);
    if (stored.pendingEncryptedSecret !== null) {
      const promoted = await this.promotePending(userId, stored.pendingEncryptedSecret, code);
      if (promoted) {
        return;
      }
    }

    await this.verifyActive(stored, code);
  }

  private async findEnrolment(userId: UserId): Promise<TotpSecret> {
    const stored = await this.totpSecretRepo.findByUser(userId);
    if (stored === null) {
      throw new TotpEnrollmentRequiredError();
    }

    return stored;
  }

  private async verifyActive(stored: TotpSecret, code: string): Promise<void> {
    const secret = await this.encryption.decrypt(stored.encryptedSecret, contextFor(stored.userId));
    const timeStep = this.totpVerifier.verify(secret, code, stored.lastUsedTimeStep);
    if (timeStep === null) {
      throw new TotpInvalidError();
    }

    // A concurrent request may have used the same code a moment ago.
    const claimed = await this.totpSecretRepo.claimTimeStep(stored.userId, timeStep, new Date());
    if (!claimed) {
      throw new TotpInvalidError();
    }

    await this.stepUpStore.stamp(stored.userId);
  }

  /**
   * False when `code` does not match the pending secret. Throws
   * TotpInvalidError when it matches but a concurrent request already
   * promoted or replaced that secret.
   */
  private async promotePending(
    userId: UserId,
    pendingSecret: EncryptedString,
    code: string,
  ): Promise<boolean> {
    const secret = await this.encryption.decrypt(pendingSecret, contextFor(userId));
    const timeStep = this.totpVerifier.verify(secret, code, null);
    if (timeStep === null) {
      return false;
    }

    const promoted = await this.totpSecretRepo.promotePending(
      userId,
      pendingSecret,
      timeStep,
      new Date(),
    );
    if (!promoted) {
      throw new TotpInvalidError();
    }

    await this.stepUpStore.stamp(userId);

    return true;
  }
}

function contextFor(userId: UserId): string {
  return `totp:${userId}`;
}
