import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { SentryExceptionFilter } from './shared/infrastructure/sentry/SentryExceptionFilter.js';

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
}

void bootstrap();
