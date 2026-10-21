import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { WorkerModule } from './worker/worker.module';
import { SentryExceptionFilter } from './infrastructure/sentry/SentryExceptionFilter.js';
import {
  assertBootEnv,
  configureHttpSecurity,
  resolveTrustProxy,
} from './bootstrap/http-security.js';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  release: process.env['SENTRY_RELEASE'],
  beforeSend(event) {
    // Strip PII from breadcrumbs
    if (event.breadcrumbs) {
      for (const crumb of event.breadcrumbs) {
        if (crumb.data) {
          delete crumb.data['email'];
          delete crumb.data['householdId'];
          delete crumb.data['userId'];
        }
      }
    }

    return event;
  },
});

async function bootstrap() {
  // Refuse to start with a missing/weak JWT_SECRET or a wildcard CORS entry.
  assertBootEnv(process.env);

  // request.ip (the per-IP rate-limit key) comes from X-Forwarded-For only for
  // the trusted proxy hops (TRUST_PROXY, default 1).
  const adapter = new FastifyAdapter({ trustProxy: resolveTrustProxy(process.env['TRUST_PROXY']) });
  const nestApp: INestApplication = await NestFactory.create(AppModule, adapter, {
    // Webhook signature checks (Resend/Svix) need the exact request bytes.
    rawBody: true,
  });
  const app = nestApp as unknown as NestFastifyApplication;

  // Swagger only with SWAGGER_ENABLED=true; CORS only from CORS_ORIGINS.
  await configureHttpSecurity(nestApp, process.env);

  app.useGlobalFilters(new SentryExceptionFilter());

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on port ${port}`);

  // Free-tier topology (ADR-002): a single container runs API + worker.
  // Standalone worker deployments use dist/src/worker.main.js instead.
  if (process.env['START_WORKER'] === 'true') {
    const worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['log', 'warn', 'error'],
    });
    worker.enableShutdownHooks();
    console.log('Embedded worker started (single-process free-tier topology)');
  }
}

bootstrap().catch((err: unknown) => {
  console.error('API bootstrap failed', err);
  process.exit(1);
});
