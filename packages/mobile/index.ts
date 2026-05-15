import * as Sentry from '@sentry/react-native';
import { registerRootComponent } from 'expo';
import { App } from './src/presentation/App.js';

Sentry.init({
  dsn: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
});

registerRootComponent(App);
