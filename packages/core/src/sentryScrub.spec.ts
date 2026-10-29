import { describe, expect, it } from 'vitest';
import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubSentryText,
  scrubSentryTransaction,
  scrubSentryUrl,
} from './sentryScrub.js';

describe('Sentry scrubbing', () => {
  it('handles adversarial URL and text inputs promptly', () => {
    for (const [scrub, input] of [
      [scrubSentryUrl, '&' + '?'.repeat(50000)],
      [scrubSentryText, 'a@'.repeat(25000)],
      [scrubSentryText, '1 '.repeat(25000)],
    ] satisfies [typeof scrubSentryUrl, string][]) {
      const start = performance.now();
      scrub(input);
      expect(performance.now() - start).toBeLessThan(100);
    }
  });
  it('keeps diagnostics and filters event data', () => {
    expect(
      scrubSentryEvent({
        user: { email: 'a@example.com' },
        request: {
          url: '/callback?code=secret&state=xyz',
          data: 'body',
          cookies: 'cookie',
          headers: {},
          query_string: 'code=x',
          env: {},
        },
        message: 'email a@example.com card 1234567890123456',
        logentry: { message: 'Bearer abc123' },
        exception: {
          values: [
            {
              type: 'BankError',
              value: 'PL61109010140000071219812874 /callback?code=secret',
              stacktrace: {
                frames: [
                  {
                    filename: 'app.js?code=secret',
                    abs_path: '/app.js?token=secret#fragment',
                    function: 'run',
                    module: 'app',
                    lineno: 1,
                    colno: 2,
                    in_app: true,
                    vars: {},
                    pre_context: [],
                    context_line: 'secret',
                    post_context: [],
                  },
                ],
              },
            },
          ],
        },
        tags: { release: 'v1' },
        release: 'v1',
        environment: 'production',
        extra: { amount: 100 },
        contexts: {
          os: { name: 'Linux' },
          trace: {
            trace_id: 'abc',
            data: { 'url.full': '/?code=secret', 'http.query': 'state=secret' },
          },
          account: { amount: 100 },
        },
      }),
    ).toEqual({
      request: { url: '/callback?code=[Filtered]&state=[Filtered]' },
      message: 'email [Filtered] card [Filtered]',
      logentry: { message: '[Filtered]' },
      exception: {
        values: [
          {
            type: 'BankError',
            value: '[Filtered] /callback?code=[Filtered]',
            stacktrace: {
              frames: [
                {
                  filename: 'app.js?code=[Filtered]',
                  abs_path: '/app.js?token=[Filtered]#[Filtered]',
                  function: 'run',
                  module: 'app',
                  lineno: 1,
                  colno: 2,
                  in_app: true,
                },
              ],
            },
          },
        ],
      },
      release: 'v1',
      environment: 'production',
      contexts: { os: { name: 'Linux' }, trace: { trace_id: 'abc' } },
    });
  });
  it('preserves issue references in text', () => {
    expect(scrubSentryEvent({ message: 'issue #123' })).toEqual({ message: 'issue #123' });
  });
  it('filters breadcrumb messages and data', () => {
    expect(
      scrubSentryBreadcrumb({
        category: 'fetch',
        level: 'info',
        type: 'http',
        timestamp: 1,
        message: 'a@example.com',
        data: { url: '/?code=x', method: 'GET', status_code: 200, args: ['secret'] },
      }),
    ).toEqual({
      category: 'fetch',
      level: 'info',
      type: 'http',
      timestamp: 1,
      message: '[Filtered]',
      data: { url: '/?code=[Filtered]', method: 'GET', status_code: 200 },
    });
  });
  it('filters transaction and span URLs', () => {
    expect(
      scrubSentryTransaction({
        transaction: 'GET /callback?code=x',
        request: { url: '/?state=x', data: 'body', headers: {}, cookies: 'x' },
        spans: [
          {
            description: 'GET /api?token=x',
            data: { url: '/api?email=x', 'http.query': 'code=x', 'url.query': 'state=x' },
          },
        ],
      }),
    ).toEqual({
      transaction: 'GET /callback?code=[Filtered]',
      request: { url: '/?state=[Filtered]' },
      spans: [
        {
          description: 'GET /api?token=[Filtered]',
          data: {
            url: '/api?email=[Filtered]',
            'http.query': 'code=[Filtered]',
            'url.query': 'state=[Filtered]',
          },
        },
      ],
    });
  });
});
