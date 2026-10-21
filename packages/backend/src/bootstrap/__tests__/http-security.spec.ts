import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { HttpTestApp } from '../../test/http/createHttpTestApp.js';
import {
  assertBootEnv,
  buildCorsOptions,
  configureHttpSecurity,
  InvalidCorsOriginError,
  isSwaggerEnabled,
  parseCorsOrigins,
  type HttpSecurityEnv,
} from '../http-security.js';
import { InvalidJwtSecretError } from '../../infrastructure/auth/jwt-secret.js';

@Controller('ping')
class PingController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

const STRONG_SECRET = 'boot-test-jwt-secret-with-at-least-32-bytes';

async function createApp(env: HttpSecurityEnv): Promise<HttpTestApp> {
  const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
  const app = moduleRef.createNestApplication(new FastifyAdapter(), { logger: false });
  await configureHttpSecurity(app, env);
  await app.init();
  const fastify: FastifyInstance = app.getHttpAdapter().getInstance();
  await fastify.ready();

  return new HttpTestApp(app, fastify);
}

describe('assertBootEnv', () => {
  it('refuses to boot a deployed API without JWT_SECRET', () => {
    expect(() => assertBootEnv({ NODE_ENV: 'staging' })).toThrow(InvalidJwtSecretError);
  });

  it('refuses to boot with a wildcard CORS origin', () => {
    expect(() =>
      assertBootEnv({ NODE_ENV: 'staging', JWT_SECRET: STRONG_SECRET, CORS_ORIGINS: '*' }),
    ).toThrow(InvalidCorsOriginError);
  });

  it('boots with a strong secret and exact origins', () => {
    expect(() =>
      assertBootEnv({
        NODE_ENV: 'staging',
        JWT_SECRET: STRONG_SECRET,
        CORS_ORIGINS: 'https://power-budget.pages.dev',
      }),
    ).not.toThrow();
  });
});

describe('parseCorsOrigins / buildCorsOptions', () => {
  it('allows no cross-origin access when CORS_ORIGINS is unset (no localhost default)', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(buildCorsOptions({}).origin).toBe(false);
  });

  it.each(['*', 'https://*', 'https://*.example.com', '*example.com', 'example.com', 'null'])(
    'rejects the unsafe entry %s',
    (entry) => {
      expect(() => parseCorsOrigins(entry)).toThrow(InvalidCorsOriginError);
    },
  );

  it('turns *.domain into an HTTPS single-label subdomain pattern', () => {
    const [pattern] = parseCorsOrigins('*.power-budget.pages.dev');

    expect(pattern).toBeInstanceOf(RegExp);
    const regex = pattern as RegExp;
    expect(regex.test('https://preview-1.power-budget.pages.dev')).toBe(true);
    expect(regex.test('http://preview-1.power-budget.pages.dev')).toBe(false);
    expect(regex.test('https://a.b.power-budget.pages.dev')).toBe(false);
    expect(regex.test('https://evil-power-budget.pages.dev')).toBe(false);
  });

  it('does not allow credentials (bearer tokens only)', () => {
    expect(buildCorsOptions({ CORS_ORIGINS: 'https://app.example.com' }).credentials).toBe(false);
  });
});

describe('isSwaggerEnabled', () => {
  it('is off unless SWAGGER_ENABLED=true, whatever NODE_ENV is', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'staging' })).toBe(false);
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isSwaggerEnabled({ SWAGGER_ENABLED: '1' })).toBe(false);
    expect(isSwaggerEnabled({ SWAGGER_ENABLED: 'true' })).toBe(true);
  });
});

describe('configureHttpSecurity (HTTP)', () => {
  let app: HttpTestApp | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('does not serve /docs on a staging deployment by default', async () => {
    app = await createApp({ NODE_ENV: 'staging' });

    const res = await app.inject({ method: 'GET', url: '/docs' });

    expect(res.statusCode).toBe(404);
  });

  it('serves /docs only when SWAGGER_ENABLED=true', async () => {
    app = await createApp({ NODE_ENV: 'development', SWAGGER_ENABLED: 'true' });

    const res = await app.inject({ method: 'GET', url: '/docs-json' });

    expect(res.statusCode).toBe(200);
  });

  it('answers a configured origin without allowing credentials', async () => {
    app = await createApp({ CORS_ORIGINS: 'https://power-budget.pages.dev' });

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://power-budget.pages.dev' },
    });

    expect(res.headers['access-control-allow-origin']).toBe('https://power-budget.pages.dev');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not answer localhost or other origins on a deployment', async () => {
    app = await createApp({ CORS_ORIGINS: 'https://power-budget.pages.dev' });

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
