import {
  scrubSentryEvent,
  scrubSentryBreadcrumb,
  scrubSentryTransaction,
} from '@power-budget/core';

export { scrubSentryEvent, scrubSentryBreadcrumb, scrubSentryTransaction };

export const sentryScrubOptions = {
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
  beforeSendTransaction: scrubSentryTransaction,
};
