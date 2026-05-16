import type { UserId } from '@power-budget/core';
import type { TotpVerifier, TotpSecretRepository, TotpStepUpStore } from '../../domain/ports.js';
import { TotpInvalidError, UserNotFoundError } from '../../domain/errors.js';
import type { VerifyTotpInput } from '../models/index.js';
export type { VerifyTotpInput };

export class VerifyTotpUseCase {
  constructor(
    private readonly totpVerifier: TotpVerifier,
    private readonly totpSecretRepo: TotpSecretRepository,
    private readonly stepUpStore: TotpStepUpStore | null = null,
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

    if (this.stepUpStore !== null) {
      await this.stepUpStore.stamp(input.userId);
    }
  }
}
