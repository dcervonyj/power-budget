import { createHash } from 'node:crypto';
import type { UserId } from '@power-budget/core';
import type { MagicLinkTokenRepository } from '../../../domain/auth/ports.js';
import { MagicLinkExpiredError } from '../../../domain/auth/errors.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';

export interface ConsumeMagicLinkInput {
  readonly token: string;
  readonly totp?: string;
}

export interface ConsumeMagicLinkOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export class ConsumeMagicLinkUseCase {
  constructor(
    private readonly magicLinkTokenRepo: MagicLinkTokenRepository,
    private readonly loginPolicy: LoginPolicy,
  ) {}

  async execute(input: ConsumeMagicLinkInput): Promise<ConsumeMagicLinkOutput> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const pending = await this.magicLinkTokenRepo.find(tokenHash);
    if (pending === null) {
      throw new MagicLinkExpiredError();
    }

    // Second factor first: a missing TOTP code must not burn the link (audit H6).
    await this.loginPolicy.assertSecondFactor(pending.userId, input.totp);

    // Atomic consume: of two concurrent requests only one gets a session (audit M9).
    const consumed = await this.magicLinkTokenRepo.consume(tokenHash);
    if (consumed === null) {
      throw new MagicLinkExpiredError();
    }

    return this.loginPolicy.issueSession(consumed.userId);
  }
}
