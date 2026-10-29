import * as Sentry from '@sentry/react-native';
import { sentryScrubOptions } from '@power-budget/core';

export function initSentry(dsn: string | undefined): void {
  Sentry.init({
    dsn,
    ...sentryScrubOptions,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}
