import type { UserId } from '@power-budget/core';
import type { TotpVerifier, TotpSecretRepository } from '../../../domain/auth/ports.js';
import { TotpInvalidError, UserNotFoundError } from '../../../domain/auth/errors.js';

export interface VerifyTotpInput {
  readonly userId: UserId;
  readonly code: string;
}

export class VerifyTotpUseCase {
  constructor(
    private readonly totpVerifier: TotpVerifier,
    private readonly totpSecretRepo: TotpSecretRepository,
  ) {}

  async execute(input: VerifyTotpInput): Promise<void> {
    const totpSecret = await this.totpSecretRepo.findByUser(input.userId);
    if (totpSecret === null) {
      throw new UserNotFoundError();
    }

    const valid = this.totpVerifier.verify(totpSecret.encryptedSecret, input.code);
    if (!valid) {
      throw new TotpInvalidError();
    }

    await this.totpSecretRepo.save({
      ...totpSecret,
      verifiedAt: new Date(),
    });
  }
}
