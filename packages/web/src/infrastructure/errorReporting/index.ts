import { loadSentry } from './loadSentry.js';
import { SentryReporter } from './SentryReporter.js';

export { ReportingErrorBoundary } from './ReportingErrorBoundary.js';
export { SentryReporter } from './SentryReporter.js';

export const sentryReporter = new SentryReporter(loadSentry, window);
