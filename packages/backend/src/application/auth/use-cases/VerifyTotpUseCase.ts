import type { UserId } from '@power-budget/core';
import type { TotpAuthenticator } from '../services/TotpAuthenticator.js';

export interface VerifyTotpInput {
  readonly userId: UserId;
  readonly code: string;
}

/** Confirms a pending enrolment, or refreshes the TOTP step-up window. */
export class VerifyTotpUseCase {
  constructor(private readonly totp: TotpAuthenticator) {}

  async execute(input: VerifyTotpInput): Promise<void> {
    await this.totp.verify(input.userId, input.code);
  }
}
