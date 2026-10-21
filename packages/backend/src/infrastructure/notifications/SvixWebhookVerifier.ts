import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SvixWebhookHeaders {
  readonly id: string | undefined;
  readonly timestamp: string | undefined;
  readonly signature: string | undefined;
}

/**
 * Verifies Resend webhooks, which are signed with Svix (audit H2).
 *
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with
 * the base64 part of the `whsec_...` secret. `svix-signature` holds one or more
 * space-separated `v1,<base64>` entries. Without a configured secret every
 * request is rejected (fail closed).
 */
export class SvixWebhookVerifier {
  private static readonly SECRET_PREFIX = 'whsec_';
  private static readonly SIGNATURE_VERSION = 'v1';
  private readonly key: Buffer | null;

  constructor(
    secret: string | undefined,
    private readonly nowMs: () => number = Date.now,
    private readonly toleranceSeconds: number = 300,
  ) {
    this.key = SvixWebhookVerifier.decodeSecret(secret);
  }

  verify(rawBody: Buffer | string | undefined, headers: SvixWebhookHeaders): boolean {
    if (this.key === null || rawBody === undefined) {
      return false;
    }
    const { id, timestamp, signature } = headers;
    if (!id || !timestamp || !signature || !this.isFresh(timestamp)) {
      return false;
    }

    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', this.key).update(`${id}.${timestamp}.${body}`).digest();

    return this.matchesAny(signature, expected);
  }

  private isFresh(timestamp: string): boolean {
    if (!/^\d+$/.test(timestamp)) {
      return false;
    }
    const ageSeconds = Math.abs(this.nowMs() / 1000 - Number(timestamp));

    return ageSeconds <= this.toleranceSeconds;
  }

  private matchesAny(signatureHeader: string, expected: Buffer): boolean {
    for (const entry of signatureHeader.split(' ')) {
      const [version, value] = entry.split(',');
      if (version !== SvixWebhookVerifier.SIGNATURE_VERSION || !value) {
        continue;
      }
      const candidate = Buffer.from(value, 'base64');
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        return true;
      }
    }

    return false;
  }

  private static decodeSecret(secret: string | undefined): Buffer | null {
    if (secret === undefined || secret.trim().length === 0) {
      return null;
    }
    const trimmed = secret.trim();
    const encoded = trimmed.startsWith(SvixWebhookVerifier.SECRET_PREFIX)
      ? trimmed.slice(SvixWebhookVerifier.SECRET_PREFIX.length)
      : trimmed;
    const key = Buffer.from(encoded, 'base64');

    return key.length > 0 ? key : null;
  }
}
