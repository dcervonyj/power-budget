import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module.js';
import { SentryExceptionFilter } from '../../infrastructure/sentry/SentryExceptionFilter.js';

export const TEST_JWT_SECRET = 'integration-test-jwt-secret';

/**
 * Boots the real AppModule on the Fastify adapter against the containers
 * (DATABASE_URL / REDIS_URL must already be set, see startContainers()).
 * Tests talk to it with `app.inject(...)`; no port is opened.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  process.env['JWT_SECRET'] = TEST_JWT_SECRET;
  process.env['KEK_BASE64'] ??= Buffer.alloc(32).toString('base64');
  process.env['RESEND_API_KEY'] ??= 're_test_placeholder';
  process.env['APP_BASE_URL'] ??= 'http://localhost:3000';

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: ['error', 'warn'],
  });
  app.useGlobalFilters(new SentryExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
