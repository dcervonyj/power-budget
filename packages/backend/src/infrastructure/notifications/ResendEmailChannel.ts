import { Resend } from 'resend';
import type { EmailChannel, EmailMessage } from '../../domain/notifications/ports.js';

/** A hung Resend call must not stall a dispatch job; the job retries with the same idempotency key. */
export const RESEND_TIMEOUT_MS = 10_000;

export class ResendEmailChannel implements EmailChannel {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
    private readonly timeoutMs: number = RESEND_TIMEOUT_MS,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    // Constructed lazily: `new Resend('')` throws, which would crash bootstrap
    // in environments without RESEND_API_KEY (development and tests).
    const client = new Resend(this.apiKey);
    const { error } = await client.emails.send(
      {
        from: message.from ?? this.fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
      },
      // Resend keeps the key for 24 h: a retry of an accepted send is not delivered twice.
      { idempotencyKey: message.idempotencyKey, signal: AbortSignal.timeout(this.timeoutMs) },
    );

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
