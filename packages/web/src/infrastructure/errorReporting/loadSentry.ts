import { scrubSentryEvent, scrubSentryBreadcrumb, scrubSentryTransaction } from './scrubSentry.js';
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
        sendDefaultPii: false,
        beforeSend: scrubSentryEvent,
        beforeBreadcrumb: scrubSentryBreadcrumb,
        beforeSendTransaction: scrubSentryTransaction,
      });
    },
    captureException: (error) => {
      Sentry.captureException(error);
    },
  };
}
