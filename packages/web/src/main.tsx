import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './presentation/App.js';
import '@fontsource-variable/geist';
// The package exports map only exposes JS, so the generated CSS is imported by path (built by turbo).
import '../../design-tokens/dist/tokens.css';
import '../../design-tokens/dist/glass.css';
import { AppProviders } from './AppProviders.js';
import { StaticCrashFallback } from './presentation/shell/StaticCrashFallback.js';
import { AppCrashFallback } from './presentation/shell/AppCrashFallback.js';
import { staleChunkRecovery } from './infrastructure/lazyChunk.js';
import { ReportingErrorBoundary, sentryReporter } from './infrastructure/errorReporting/index.js';

staleChunkRecovery.install();

void sentryReporter.start(import.meta.env.VITE_SENTRY_DSN);

// Inner boundary: translated fallback. Outer boundary: covers provider render errors and
// failed locale chunks, where react-intl is unavailable, so it uses a small static string table.
const reportError = (error: unknown): void => sentryReporter.capture(error);

const GuardedApp = (): React.JSX.Element => (
  <ReportingErrorBoundary fallback={<AppCrashFallback />} onError={reportError}>
    <App />
  </ReportingErrorBoundary>
);

const OuterGuard = (): React.JSX.Element => (
  <ReportingErrorBoundary fallback={<StaticCrashFallback />} onError={reportError}>
    <BrowserRouter>
      <AppProviders>
        <GuardedApp />
      </AppProviders>
    </BrowserRouter>
  </ReportingErrorBoundary>
);

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <OuterGuard />
  </React.StrictMode>,
);
