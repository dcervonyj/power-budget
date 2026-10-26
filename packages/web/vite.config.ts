import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import {
  buildSecurityHeaders,
  renderHeadersFile,
  type SecurityHeaders,
} from './src/infrastructure/security/securityHeaders.js';

const DEFAULT_API_URL = 'http://localhost:3000';

/** Writes `dist/_headers` (Cloudflare Pages) with the production CSP. */
function securityHeadersFile(headers: SecurityHeaders): Plugin {
  return {
    name: 'power-budget:security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: renderHeadersFile(headers) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env['VITE_API_URL'] || DEFAULT_API_URL;
  const sentryDsn = env['VITE_SENTRY_DSN'] || undefined;
  const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN'];
  const productionHeaders = buildSecurityHeaders({ apiUrl, sentryDsn, dev: false });

  // `vite build --mode gallery` (build:gallery) builds only gallery.html into dist-gallery,
  // so the gallery never reaches the production dist.
  const gallery = mode === 'gallery';
  const plugins: PluginOption[] = [react(), securityHeadersFile(productionHeaders)];
  // Source maps are built only to upload them to Sentry (CI), never referenced
  // from the bundle and deleted from dist afterwards, so they are not public.
  if (sentryAuthToken && !gallery) {
    plugins.push(
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: process.env['SENTRY_ORG'] ?? 'power-budget',
        project: process.env['SENTRY_PROJECT'] ?? 'web',
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      }),
    );
  }

  return {
    plugins,
    build: {
      sourcemap: sentryAuthToken && !gallery ? 'hidden' : false,
      ...(gallery
        ? {
            outDir: 'dist-gallery',
            rollupOptions: { input: path.resolve(__dirname, 'gallery.html') },
          }
        : {}),
    },
    resolve: {
      alias: {
        '@web': path.resolve(__dirname, './src'),
      },
    },
    server: {
      headers: buildSecurityHeaders({ apiUrl, sentryDsn, dev: true }),
    },
    preview: {
      headers: productionHeaders,
    },
  };
});
