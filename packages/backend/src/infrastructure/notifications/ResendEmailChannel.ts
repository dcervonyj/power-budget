import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailChannel } from '../../domain/notifications/ports.js';

@Injectable()
export class ResendEmailChannel implements EmailChannel {
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress = 'Power Budget <noreply@powerbudget.app>') {
    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(input: { to: string; subject: string; html: string; from?: string }): Promise<void> {
    const { error } = await this.client.emails.send({
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
