import * as Sentry from '@sentry/react-native';
import { registerRootComponent } from 'expo';
import { App } from './src/presentation/App.js';

Sentry.init({
  dsn: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
});

// DSN-031: `EXPO_PUBLIC_GALLERY=1` swaps the app for the component gallery. Expo inlines the
// literal at bundle time and Metro drops the dead branch, so a production export (variable
// unset) contains no gallery code; e2e-web/production-export.test.mjs checks that.
if (process.env.EXPO_PUBLIC_GALLERY === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerGallery } = require('./src/gallery/main.js');

  registerGallery();
} else {
  registerRootComponent(App);
}
