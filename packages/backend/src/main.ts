import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { sentryScrubOptions } from './infrastructure/sentry/scrubSentry.js';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { SentryExceptionFilter } from './infrastructure/sentry/SentryExceptionFilter.js';
import { configureHttpSecurity } from './bootstrap/http-security.js';
import { type AppConfig } from './config/AppConfig.js';
import { loadAppConfig } from './config/load-app-config.js';
import { startEmbeddedWorker } from './bootstrap/embedded-worker.js';

function initSentry(config: AppConfig): void {
  Sentry.init({
    dsn: config.sentryDsn ?? undefined,
    environment: config.nodeEnv,
    release: config.sentryRelease ?? undefined,
    ...sentryScrubOptions,
  });
}

async function bootstrap() {
  // Fails fast, listing every missing/invalid variable (weak JWT_SECRET, wildcard CORS, ...).
  const config = loadAppConfig('api');
  initSentry(config);

  // request.ip (the per-IP rate-limit key) comes from X-Forwarded-For only for
  // the trusted proxy hops (TRUST_PROXY, default: private-range proxies).
  const adapter = new FastifyAdapter({ trustProxy: config.trustProxy });
  const nestApp: INestApplication = await NestFactory.create(AppModule, adapter, {
    // Webhook signature checks (Resend/Svix) need the exact request bytes.
    rawBody: true,
  });
  const app = nestApp as unknown as NestFastifyApplication;

  // Swagger only with SWAGGER_ENABLED=true; CORS only from CORS_ORIGINS.
  await configureHttpSecurity(nestApp, {
    CORS_ORIGINS: config.corsOrigins,
    SWAGGER_ENABLED: String(config.swaggerEnabled),
  });

  app.useGlobalFilters(new SentryExceptionFilter());
  // SIGTERM (Render deploy) closes queues and the shared queue Redis connection (CLN-056).
  nestApp.enableShutdownHooks();

  // Response compression is deliberately NOT registered here (CLN-056 / PERF-16). Checked
  // 28 Oct 2026: `curl -sD- -o/dev/null -H 'Accept-Encoding: gzip, br'
  // https://power-budget-api-eu.onrender.com/health` returns `content-encoding: br` with
  // `server: cloudflare`; Render's edge already compresses application/json (a 400 from
  // POST /auth/login too). See docs/mvp/adr/ADR-003-render-starter-always-on.md.

  const port = config.port;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on port ${port}`);

  // Free-tier topology (ADR-002): a single container runs API + worker.
  // Standalone worker deployments use dist/src/worker.main.js instead.
  await startEmbeddedWorker(config);
}

bootstrap().catch((err: unknown) => {
  console.error('API bootstrap failed', err);
  process.exit(1);
});
