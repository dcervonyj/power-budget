import { Resend } from 'resend';
import type { EmailChannel, EmailMessage } from '../../domain/notifications/ports.js';

export class ResendEmailChannel implements EmailChannel {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
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
      { idempotencyKey: message.idempotencyKey },
    );

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
