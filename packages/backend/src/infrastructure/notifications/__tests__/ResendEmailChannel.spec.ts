import { describe, it, expect } from 'vitest';
import { ResendEmailChannel } from '../ResendEmailChannel.js';
import {
  DEFAULT_EMAIL_FROM,
  MissingEmailConfigError,
  resolveEmailConfig,
} from '../email-config.js';

describe('ResendEmailChannel', () => {
  it('constructs without an API key so a development boot survives a missing RESEND_API_KEY', () => {
    expect(() => new ResendEmailChannel('', DEFAULT_EMAIL_FROM)).not.toThrow();
  });

  it('fails at send time when the API key is missing', async () => {
    const channel = new ResendEmailChannel('', DEFAULT_EMAIL_FROM);

    await expect(
      channel.send({
        to: 'user@example.com',
        subject: 'hi',
        html: '<p>hi</p>',
        idempotencyKey: 'notification-n-1',
      }),
    ).rejects.toThrow();
  });
});

describe('resolveEmailConfig (worker boot check)', () => {
  it.each(['production', 'staging'])('refuses NODE_ENV=%s without RESEND_API_KEY', (nodeEnv) => {
    expect(() => resolveEmailConfig({ NODE_ENV: nodeEnv, RESEND_API_KEY: ' ' })).toThrow(
      MissingEmailConfigError,
    );
  });

  it('allows a missing key in development and tests', () => {
    expect(resolveEmailConfig({ NODE_ENV: 'test' })).toEqual({
      resendApiKey: '',
      from: DEFAULT_EMAIL_FROM,
    });
  });

  it('uses RESEND_API_KEY and EMAIL_FROM when set', () => {
    expect(
      resolveEmailConfig({
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_live_123',
        EMAIL_FROM: 'Budget <mail@example.com>',
      }),
    ).toEqual({ resendApiKey: 're_live_123', from: 'Budget <mail@example.com>' });
  });
});
