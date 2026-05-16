import { createHash, randomBytes } from 'node:crypto';
import type {
  UserRepository,
  MagicLinkTokenRepository,
  NotificationOutboxPort,
} from '../../domain/ports.js';
import type { RequestMagicLinkInput } from '../models/index.js';
export type { RequestMagicLinkInput };

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_BYTES = 32;

export class RequestMagicLinkUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly magicLinkTokenRepo: MagicLinkTokenRepository,
    private readonly notificationOutbox: NotificationOutboxPort,
  ) {}

  async execute(input: RequestMagicLinkInput): Promise<void> {
    // Always returns 204 — even when the email is not found (security: no email enumeration).
    const user = await this.userRepo.findByEmail(input.email);
    if (user === null) {
      return;
    }

    const rawToken = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

    await this.magicLinkTokenRepo.save({ tokenHash, userId: user.id, expiresAt });

    await this.notificationOutbox.enqueue({
      kind: 'magic_link',
      userId: user.id,
      payload: { email: user.email, token: rawToken },
      dedupeKey: `magic_link:${user.id}:${tokenHash}`,
    });
  }
}
