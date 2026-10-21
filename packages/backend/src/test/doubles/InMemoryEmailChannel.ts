import type { EmailChannel, EmailMessage } from '../../domain/notifications/ports.js';

export type SentEmail = EmailMessage;

/**
 * Behaves like Resend for idempotency: a second send with a key it has already
 * accepted is acknowledged but not delivered again.
 */
export class InMemoryEmailChannel implements EmailChannel {
  /** Every send call, including retries. */
  readonly calls: SentEmail[] = [];
  /** Delivered emails: at most one per idempotency key. */
  readonly sent: SentEmail[] = [];
  private lostAcknowledgements = 0;
  private failures = 0;

  /** The next `count` sends are delivered, but the caller gets a timeout (a lost response). */
  loseNextAcknowledgements(count: number): void {
    this.lostAcknowledgements = count;
  }

  /** The next `count` sends fail before anything is delivered. */
  failNext(count: number): void {
    this.failures = count;
  }

  async send(message: SentEmail): Promise<void> {
    this.calls.push({ ...message });
    if (this.failures > 0) {
      this.failures--;
      throw new Error('Email provider unavailable');
    }
    if (!this.sent.some((email) => email.idempotencyKey === message.idempotencyKey)) {
      this.sent.push({ ...message });
    }
    if (this.lostAcknowledgements > 0) {
      this.lostAcknowledgements--;
      throw new Error('ETIMEDOUT: no response from the email provider');
    }
  }
}
