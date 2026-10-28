import type { SentryModule } from './SentryReporter.js';

interface UserWithPii {
  email?: string;
  ip_address?: string | null;
}

/** Strips PII before an event leaves the browser. */
export function scrubUser<E extends { user?: UserWithPii | undefined }>(event: E): E {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  return event;
}

/** Dynamic import: this is the only place the Sentry SDK is referenced, so it splits out. */
export async function loadSentry(): Promise<SentryModule> {
  const Sentry = await import('@sentry/react');

  return {
    init: (dsn) => {
      Sentry.init({
        dsn,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        beforeSend: scrubUser,
      });
    },
    captureException: (error) => {
      Sentry.captureException(error);
    },
  };
}
