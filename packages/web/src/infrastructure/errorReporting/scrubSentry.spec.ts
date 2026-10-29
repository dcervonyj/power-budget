import { describe, expect, it } from 'vitest';
import { scrubSentryEvent, scrubSentryBreadcrumb } from './scrubSentry.js';

describe('Sentry hooks', () => {
  it('scrubs callback events and network breadcrumbs', () => {
    expect(
      scrubSentryEvent({
        user: { id: '1', email: 'a@example.com', ip_address: '1.2.3.4' },
        request: {
          url: '/bank/callback?code=secret&state=xyz',
          query_string: 'code=secret',
          data: 'body',
          cookies: 'cookie',
          headers: { authorization: 'secret' },
        },
        breadcrumbs: [
          {
            category: 'fetch',
            data: {
              url: '/api?email=a@example.com',
              body: 'payment',
              response: 'secret',
              request_body_size: 42,
            },
          },
        ],
      }),
    ).toEqual({
      request: { url: '/bank/callback?code=[Filtered]&state=[Filtered]' },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api?email=[Filtered]' } }],
    });
    expect(
      scrubSentryBreadcrumb({
        data: { from: '/?code=secret', to: '/?state=secret', response: 'body' },
      }),
    ).toEqual({ data: { from: '/?code=[Filtered]', to: '/?state=[Filtered]' } });
  });
});
