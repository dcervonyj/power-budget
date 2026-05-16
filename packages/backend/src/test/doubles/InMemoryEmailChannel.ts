import type { EmailChannel } from '../../domain/notifications/ports.js';

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export class InMemoryEmailChannel implements EmailChannel {
  readonly sent: SentEmail[] = [];

  async send(input: SentEmail): Promise<void> {
    this.sent.push({ ...input });
  }
}
