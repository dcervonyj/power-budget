/** Source of the current instant. Use cases read time only through this port. */
export interface Clock {
  now(): Date;
}

/** Source of new entity ids (UUIDv7, time-ordered). */
export interface IdGenerator {
  next(): string;
}

export type WebhookHeaders = Readonly<Record<string, string | string[] | undefined>>;

/**
 * Checks that an incoming webhook was signed by its provider. Webhook guards and
 * controllers depend on this port only; each provider (Svix/Resend, Wise, an email
 * ingest HMAC) is one adapter. Fails closed: false for a missing body, missing
 * headers, a bad or stale signature, or a verifier without a secret.
 */
export interface WebhookSignatureVerifier {
  verify(rawBody: Buffer | string | undefined, headers: WebhookHeaders): boolean;
}
