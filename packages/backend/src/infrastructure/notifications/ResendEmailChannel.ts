import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailChannel } from '../../domain/notifications/ports.js';

@Injectable()
export class ResendEmailChannel implements EmailChannel {
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress = 'Power Budget <noreply@powerbudget.app>') {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async send(input: { to: string; subject: string; html: string; from?: string }): Promise<void> {
    // Constructed lazily: `new Resend('')` throws, which would crash bootstrap
    // in environments without RESEND_API_KEY.
    const client = new Resend(this.apiKey);
    const { error } = await client.emails.send({
      from: input.from ?? this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
