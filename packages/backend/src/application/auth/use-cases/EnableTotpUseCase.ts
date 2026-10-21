import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../../domain/auth/ports.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import type { TotpAuthenticator } from '../services/TotpAuthenticator.js';

export interface EnableTotpInput {
  readonly userId: UserId;
}

export interface EnableTotpOutput {
  readonly qrCodeUri: string;
  readonly secret: string;
}

export class EnableTotpUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly totp: TotpAuthenticator,
  ) {}

  async execute(input: EnableTotpInput): Promise<EnableTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    return this.totp.enrol(user);
  }
}
