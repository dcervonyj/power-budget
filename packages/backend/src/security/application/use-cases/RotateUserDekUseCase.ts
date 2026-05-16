import type { UserId } from '@power-budget/core';
import type {
  UserRepository,
  TotpSecretRepository,
  Encryption,
} from '../../../auth/domain/ports.js';
import type { RotateUserDekInput, RotateUserDekOutput } from '../models/index.js';
export type { RotateUserDekInput, RotateUserDekOutput };

/**
 * Re-encrypts all per-user sensitive fields under the current KEK.
 * This is a no-op if the user has no TOTP secret (nothing to rotate).
 * When a true per-user DEK table is introduced (BE-023+), this use case
 * will generate a new DEK, wrap it with the KEK, and re-encrypt all secrets.
 */
export class RotateUserDekUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly totpSecretRepo: TotpSecretRepository,
    private readonly encryption: Encryption,
  ) {}

  async execute(input: RotateUserDekInput): Promise<RotateUserDekOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (user === null) {
      return { fieldsRotated: 0, skipped: true };
    }

    let fieldsRotated = 0;
    fieldsRotated += await this.rotateTotpSecret(input.userId);

    return { fieldsRotated, skipped: false };
  }

  private async rotateTotpSecret(userId: UserId): Promise<number> {
    const secret = await this.totpSecretRepo.findByUser(userId);
    if (secret === null) {
      return 0;
    }

    // Decrypt with current KEK, then re-encrypt (generates new IV — effectively a re-wrap)
    const plaintext = await this.encryption.decrypt(
      secret.encryptedSecret as import('@power-budget/core').EncryptedString,
    );
    const reEncrypted = await this.encryption.encrypt(plaintext);

    await this.totpSecretRepo.save({
      ...secret,
      encryptedSecret: reEncrypted,
    });

    return 1;
  }
}
