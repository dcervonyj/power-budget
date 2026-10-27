import React from 'react';
import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './presentation/App.js';
import '@fontsource-variable/geist';
// The package exports map only exposes JS, so the generated CSS is imported by path (built by turbo).
import '../../design-tokens/dist/tokens.css';
import '../../design-tokens/dist/glass.css';
import { AppProviders } from './AppProviders.js';
import { AppCrashFallback } from './presentation/shell/AppCrashFallback.js';
import { reloadOnStaleChunk } from './infrastructure/reloadOnStaleChunk.js';

reloadOnStaleChunk({
  addEventListener: (type, listener) => window.addEventListener(type, listener),
  location: window.location,
  sessionStorage: window.sessionStorage,
  now: () => Date.now(),
});

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

// The boundary sits inside AppProviders so its fallback can use translations.
const GuardedApp = Sentry.withErrorBoundary(App, { fallback: <AppCrashFallback /> });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <GuardedApp />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
