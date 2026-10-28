// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { createHash } from 'node:crypto';
import type { UserId } from '@power-budget/core';
import type { FailedAttemptCounter, MagicLinkTokenRepository } from '../../../domain/auth/ports.js';
import { MagicLinkExpiredError, TotpInvalidError } from '../../../domain/auth/errors.js';
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

/** Wrong TOTP codes one link survives; the last one burns it (CLN-031, audit BE-BUGS-02). */
export const MAX_WRONG_CODES_PER_LINK = 3;
/** As long as a link lives (RequestMagicLinkUseCase), so the count outlives no link. */
const LINK_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export class ConsumeMagicLinkUseCase {
  constructor(
    private readonly magicLinkTokenRepo: MagicLinkTokenRepository,
    private readonly loginPolicy: LoginPolicy,
    private readonly attemptCounter: FailedAttemptCounter,
  ) {}

  async execute(input: ConsumeMagicLinkInput): Promise<ConsumeMagicLinkOutput> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const pending = await this.magicLinkTokenRepo.find(tokenHash);
    if (pending === null) {
      throw new MagicLinkExpiredError();
    }

    // Second factor first: a missing TOTP code must not burn the link (audit H6).
    try {
      await this.loginPolicy.assertSecondFactor(pending.userId, input.totp);
    } catch (error) {
      if (error instanceof TotpInvalidError) {
        await this.countWrongCode(tokenHash);
      }
      throw error;
    }

    // Atomic consume: of two concurrent requests only one gets a session (audit M9).
    const consumed = await this.magicLinkTokenRepo.consume(tokenHash);
    if (consumed === null) {
      throw new MagicLinkExpiredError();
    }

    return this.loginPolicy.issueSession(consumed.userId);
  }

  /** After MAX_WRONG_CODES_PER_LINK wrong codes the link is gone; a new one must be requested. */
  private async countWrongCode(tokenHash: string): Promise<void> {
    const key = `magic-link-failures:${tokenHash}`;
    const current = await this.attemptCounter.increment(key, LINK_ATTEMPT_WINDOW_SECONDS);
    if (current.attempts < MAX_WRONG_CODES_PER_LINK) {
      return;
    }

    await this.magicLinkTokenRepo.consume(tokenHash);
    await this.attemptCounter.reset(key);
  }
}
