import type { UserId } from '@power-budget/core';
import type { UserRepository, TotpVerifier, TotpSecretRepository } from '../../domain/ports.js';
import { UserNotFoundError } from '../../domain/errors.js';
import type { EnableTotpInput, EnableTotpOutput } from '../models/index.js';
export type { EnableTotpInput, EnableTotpOutput };

export class EnableTotpUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly totpVerifier: TotpVerifier,
    private readonly totpSecretRepo: TotpSecretRepository,
  ) {}

  async execute(input: EnableTotpInput): Promise<EnableTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    const { secret, otpauthUri } = this.totpVerifier.generateSecret(user.email);

    await this.totpSecretRepo.save({
      userId: user.id,
      encryptedSecret: secret,
      enrolledAt: new Date(),
      verifiedAt: null,
    });

    return { qrCodeUri: otpauthUri, secret };
  }
}
