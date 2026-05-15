import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const plugins = [react()];

// Only upload source maps when SENTRY_AUTH_TOKEN is present (CI)
if (process.env['SENTRY_AUTH_TOKEN']) {
  plugins.push(
    sentryVitePlugin({
      authToken: process.env['SENTRY_AUTH_TOKEN'],
      org: process.env['SENTRY_ORG'] ?? 'power-budget',
      project: process.env['SENTRY_PROJECT'] ?? 'web',
    }),
  );
}

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

export default defineConfig({
  plugins,
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
});
