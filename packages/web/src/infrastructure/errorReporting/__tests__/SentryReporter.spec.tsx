import React from 'react';
import { createMock } from '@golevelup/ts-vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SentryReporter, type ErrorTarget, type SentryModule } from '../SentryReporter.js';
import { loadSentry } from '../loadSentry.js';
import {
  scrubSentryEvent,
  scrubSentryBreadcrumb,
  scrubSentryTransaction,
} from '@power-budget/core';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn(() => 'tracing'),
}));

vi.mock('@sentry/react', () => sdk);
import { ReportingErrorBoundary } from '../ReportingErrorBoundary.js';

function fakeSentry(): SentryModule {
  return createMock<SentryModule>();
}

function fakeTarget(): ErrorTarget & { fire(type: string, event: object): void } {
  const listeners = new Map<string, Set<(event: Event) => void>>();

  return Object.assign(
    createMock<ErrorTarget>({
      addEventListener: (type, listener) => {
        listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
      },
      removeEventListener: (type, listener) => {
        listeners.get(type)?.delete(listener);
      },
    }),
    {
      fire: (type: string, event: object) => {
        listeners.get(type)?.forEach((listener) => listener(Object.assign(new Event(type), event)));
      },
    },
  );
}

describe('SentryReporter', () => {
  it('never loads Sentry without a DSN', async () => {
    const load = vi.fn(() => Promise.resolve(fakeSentry()));
    const reporter = new SentryReporter(load, fakeTarget());

    await reporter.start(undefined);
    await reporter.start('');
    reporter.capture(new Error('x'));

    expect(load).not.toHaveBeenCalled();
    expect(reporter.enabled).toBe(false);
  });

  it('loads and initialises Sentry when a DSN is set', async () => {
    const sentry = fakeSentry();
    const reporter = new SentryReporter(() => Promise.resolve(sentry), fakeTarget());

    await reporter.start('https://key@o1.ingest.sentry.io/42');

    expect(sentry.init).toHaveBeenCalledWith('https://key@o1.ingest.sentry.io/42');
  });

  it('queues errors raised before Sentry loads and flushes them after init', async () => {
    const sentry = fakeSentry();
    const target = fakeTarget();
    let release: (module: SentryModule) => void = () => undefined;
    const reporter = new SentryReporter(
      () => new Promise<SentryModule>((resolve) => (release = resolve)),
      target,
    );
    const early = new Error('early');
    const rejected = new Error('rejected');
    const caught = new Error('caught');

    const started = reporter.start('https://key@o1.ingest.sentry.io/42');
    target.fire('error', { error: early });
    target.fire('unhandledrejection', { reason: rejected });
    reporter.capture(caught);
    release(sentry);
    await started;

    expect(sentry.captureException).toHaveBeenCalledTimes(3);
    expect(sentry.captureException).toHaveBeenCalledWith(early);
    expect(sentry.captureException).toHaveBeenCalledWith(rejected);
    expect(sentry.captureException).toHaveBeenCalledWith(caught);
  });

  it('sends later captures straight to Sentry and stops queueing window errors', async () => {
    const sentry = fakeSentry();
    const target = fakeTarget();
    const reporter = new SentryReporter(() => Promise.resolve(sentry), target);
    const later = new Error('later');

    await reporter.start('https://key@o1.ingest.sentry.io/42');
    target.fire('error', { error: new Error('handled by Sentry itself') });
    reporter.capture(later);

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(later);
  });

  it('survives a failed Sentry chunk load', async () => {
    const reporter = new SentryReporter(() => Promise.reject(new Error('offline')), fakeTarget());

    await expect(reporter.start('https://key@o1.ingest.sentry.io/42')).resolves.toBeUndefined();
    expect(() => reporter.capture(new Error('x'))).not.toThrow();
  });

  it('removes email and ip address from events', () => {
    expect(scrubSentryEvent({ user: { id: '1', email: 'a@b.c', ip_address: '1.1.1.1' } })).toEqual(
      {},
    );
  });
});

describe('loadSentry', () => {
  it('initialises the SDK with tracing at 10% and PII scrubbing', async () => {
    (await loadSentry()).init('https://key@o1.ingest.sentry.io/42');

    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o1.ingest.sentry.io/42',
        integrations: ['tracing'],
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
        beforeSend: scrubSentryEvent,
        beforeBreadcrumb: scrubSentryBreadcrumb,
        beforeSendTransaction: scrubSentryTransaction,
      }),
    );
  });
});

describe('ReportingErrorBoundary', () => {
  it('renders the fallback and reports the error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();
    const boom = new Error('boom');
    const Bomb = (): React.JSX.Element => {
      throw boom;
    };

    render(
      <ReportingErrorBoundary fallback={<p>fallback</p>} onError={onError}>
        <Bomb />
      </ReportingErrorBoundary>,
    );

    expect(screen.getByText('fallback')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(boom);
  });
});
