import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import * as jwt from 'jsonwebtoken';
import type { HouseholdId, UserId } from '@power-budget/core';
import { SentryExceptionFilter } from '../../infrastructure/sentry/SentryExceptionFilter.js';

/**
 * Minimal Nest + Fastify app for HTTP-level tests (no database, no Redis).
 * Requests go through Fastify `inject`, so routing, guards, param decorators
 * and status codes are exercised exactly as in production.
 */
export const HTTP_TEST_JWT_SECRET = 'http-test-jwt-secret-that-is-at-least-32-bytes';

export interface HttpTestAppOptions {
  readonly controllers: Type<unknown>[];
  readonly providers?: Provider[];
  readonly env?: Record<string, string>;
}

/** The Nest app plus Fastify `inject`, without the Nest 10/11 typing clash on NestFastifyApplication. */
export class HttpTestApp {
  constructor(
    private readonly nestApp: INestApplication,
    private readonly fastify: FastifyInstance,
  ) {}

  inject(options: InjectOptions): Promise<LightMyRequestResponse> {
    return this.fastify.inject(options);
  }

  async close(): Promise<void> {
    await this.nestApp.close();
  }
}

export async function createHttpTestApp(options: HttpTestAppOptions): Promise<HttpTestApp> {
  const env = { NODE_ENV: 'test', JWT_SECRET: HTTP_TEST_JWT_SECRET, ...options.env };
  const moduleRef = await Test.createTestingModule({
    controllers: options.controllers,
    providers: [
      { provide: ConfigService, useValue: new ConfigService(env) },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication(new FastifyAdapter(), {
    rawBody: true,
    logger: false,
  });
  // Same error-to-status mapping as main.ts.
  app.useGlobalFilters(new SentryExceptionFilter());
  await app.init();
  const fastify: FastifyInstance = app.getHttpAdapter().getInstance();
  await fastify.ready();

  return new HttpTestApp(app, fastify);
}

export function bearerFor(userId: UserId, householdId: HouseholdId | null): string {
  const token = jwt.sign({ sub: userId, householdId }, HTTP_TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });

  return `Bearer ${token}`;
}
