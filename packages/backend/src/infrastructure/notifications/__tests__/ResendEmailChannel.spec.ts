import { describe, it, expect } from 'vitest';
import { ResendEmailChannel } from '../ResendEmailChannel.js';

describe('ResendEmailChannel', () => {
  it('constructs without an API key so bootstrap survives missing RESEND_API_KEY', () => {
    expect(() => new ResendEmailChannel('')).not.toThrow();
  });

  it('fails at send time when the API key is missing', async () => {
    const channel = new ResendEmailChannel('');

    await expect(
      channel.send({ to: 'user@example.com', subject: 'hi', html: '<p>hi</p>' }),
    ).rejects.toThrow();
  });
});
