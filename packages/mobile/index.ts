import * as Sentry from '@sentry/react-native';
import { sentryScrubOptions } from './src/infrastructure/errorReporting/scrubSentry.js';
import { registerRootComponent } from 'expo';

Sentry.init({
  dsn: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  ...sentryScrubOptions,
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
  // Required here, not imported at the top: in gallery mode the app graph must not be evaluated,
  // or a Skia import in it runs before CanvasKit is loaded (see src/gallery/main.tsx).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { App } = require('./src/presentation/App.js');

  registerRootComponent(App);
}
