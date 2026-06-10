import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { WorkerModule } from './worker/worker.module';
import { SentryExceptionFilter } from './infrastructure/sentry/SentryExceptionFilter.js';

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
  const nestApp: INestApplication = await NestFactory.create(AppModule, new FastifyAdapter());
  const app = nestApp as unknown as NestFastifyApplication;

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Power Budget API')
      .setVersion('1.0')
      .setOpenAPIVersion('3.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(nestApp, config);
    SwaggerModule.setup('docs', nestApp, document);
  }

  // Browser clients (Cloudflare Pages, local Vite) live on other origins.
  // CORS_ORIGINS: comma-separated exact origins; entries like *.example.com
  // allow any direct subdomain (Cloudflare Pages preview deployments).
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) =>
      origin.startsWith('*.')
        ? new RegExp(`^https://[a-z0-9-]+\\.${origin.slice(2).replaceAll('.', '\\.')}$`)
        : origin,
    );
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'same-origin' },
  });

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

void bootstrap();
