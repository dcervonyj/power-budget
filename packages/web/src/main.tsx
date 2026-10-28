import React from 'react';
import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './presentation/App.js';
import '@fontsource-variable/geist';
// The package exports map only exposes JS, so the generated CSS is imported by path (built by turbo).
import '../../design-tokens/dist/tokens.css';
import '../../design-tokens/dist/glass.css';
import { IntlProvider } from 'react-intl';
import { AppProviders } from './AppProviders.js';
import { AppCrashFallback } from './presentation/shell/AppCrashFallback.js';
import { staleChunkRecovery } from './infrastructure/lazyChunk.js';

staleChunkRecovery.install();

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.user) {
      delete event.user['email'];
      delete event.user['ip_address'];
    }

    return event;
  },
});

// Inner boundary: translated fallback. Outer boundary: covers provider render errors and
// failed locale chunks, where no translations exist, so it falls back to English.
const GuardedApp = Sentry.withErrorBoundary(App, { fallback: <AppCrashFallback /> });

const OuterGuard = Sentry.withErrorBoundary(
  () => (
    <BrowserRouter>
      <AppProviders>
        <GuardedApp />
      </AppProviders>
    </BrowserRouter>
  ),
  {
    fallback: (
      <IntlProvider locale="en" defaultLocale="en" messages={{}}>
        <AppCrashFallback />
      </IntlProvider>
    ),
  },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OuterGuard />
  </React.StrictMode>,
);
