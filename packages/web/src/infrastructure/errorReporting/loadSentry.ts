import { sentryScrubOptions } from '@power-budget/core';
import type { SentryModule } from './SentryReporter.js';

/** Dynamic import: this is the only place the Sentry SDK is referenced, so it splits out. */
export async function loadSentry(): Promise<SentryModule> {
  const Sentry = await import('@sentry/react');

  return {
    init: (dsn) => {
      Sentry.init({
        dsn,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        ...sentryScrubOptions,
      });
    },
    captureException: (error) => {
      Sentry.captureException(error);
    },
  };
}
