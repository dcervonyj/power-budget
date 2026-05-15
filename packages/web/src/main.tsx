import React from 'react';
import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './presentation/App.js';
import { AppProviders } from './AppProviders.js';

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

const SentryApp = Sentry.withErrorBoundary(
  () => (
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  ),
  { fallback: <p>An error occurred.</p> },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryApp />
  </React.StrictMode>,
);
