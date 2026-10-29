import * as Sentry from '@sentry/node';
import { sentryScrubOptions } from '@power-budget/core';
import type { AppConfig } from '../../config/AppConfig.js';

export function initSentry(config: AppConfig): void {
  Sentry.init({
    dsn: config.sentryDsn ?? undefined,
    environment: config.nodeEnv,
    release: config.sentryRelease ?? undefined,
    ...sentryScrubOptions,
  });
}
