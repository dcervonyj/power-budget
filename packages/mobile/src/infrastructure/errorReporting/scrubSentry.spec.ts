import { describe, expect, it } from 'vitest';
import {
  scrubSentryEvent,
  scrubSentryBreadcrumb,
  scrubSentryTransaction,
  sentryScrubOptions,
} from './scrubSentry.js';

describe('Sentry hooks', () => {
  it('configures every scrub hook', () => {
    expect(sentryScrubOptions).toEqual({
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
      beforeBreadcrumb: scrubSentryBreadcrumb,
      beforeSendTransaction: scrubSentryTransaction,
    });
  });
  it('scrubs callback events and network breadcrumbs', () => {
    expect(
      scrubSentryEvent({
        user: { id: '1', email: 'a@example.com', ip_address: '1.2.3.4' },
        request: {
          url: '/bank/callback?code=secret&state=xyz',
          data: 'body',
          cookies: 'cookie',
          headers: { authorization: 'secret' },
        },
        breadcrumbs: [{ data: { url: '/api?email=a@example.com', body: 'payment' } }],
      }),
    ).toEqual({
      request: { url: '/bank/callback?code=[Filtered]&state=[Filtered]' },
      breadcrumbs: [{ data: { url: '/api?email=[Filtered]' } }],
    });
    expect(
      scrubSentryBreadcrumb({
        data: { from: '/?code=secret', to: '/?state=secret', response: 'body' },
      }),
    ).toEqual({ data: { from: '/?code=[Filtered]', to: '/?state=[Filtered]' } });
  });
});
