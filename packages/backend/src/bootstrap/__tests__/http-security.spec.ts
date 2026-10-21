import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { HttpTestApp } from '../../test/http/createHttpTestApp.js';
import {
  resolveTrustProxy,
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
    expect(parseCorsOrigins(undefined).rules).toEqual([]);
    expect(buildCorsOptions({}).origin).toBe(false);
  });

  it.each([
    '*',
    'https://*',
    'https://*.example.com',
    '*example.com',
    '*.com',
    '*.exa_mple.com',
    '*.example.com/',
    'example.com',
    'null',
  ])('rejects the unsafe entry %s', (entry) => {
    expect(() => parseCorsOrigins(entry)).toThrow(InvalidCorsOriginError);
  });

  it('lets *.domain match exactly one HTTPS DNS label', () => {
    const policy = parseCorsOrigins('*.power-budget.pages.dev');

    expect(policy.isAllowed('https://preview-1.power-budget.pages.dev')).toBe(true);
    expect(policy.isAllowed('https://power-budget.pages.dev')).toBe(false);
    expect(policy.isAllowed('http://preview-1.power-budget.pages.dev')).toBe(false);
    expect(policy.isAllowed('https://preview-1.power-budget.pages.dev:8443')).toBe(false);
    expect(policy.isAllowed('https://a.b.power-budget.pages.dev')).toBe(false);
    expect(policy.isAllowed('https://evil-power-budget.pages.dev')).toBe(false);
  });

  it('rejects look-alike hosts where a dot is replaced or the domain is a prefix', () => {
    const policy = parseCorsOrigins('*.power-budget.pages.dev,https://power-budget.pages.dev');

    expect(policy.isAllowed('https://preview.power-budgetXpages.dev')).toBe(false);
    expect(policy.isAllowed('https://preview.power-budget.pagesXdev')).toBe(false);
    expect(policy.isAllowed('https://preview.power-budget.pages.dev.attacker.test')).toBe(false);
    expect(policy.isAllowed('https://power-budget.pages.dev.attacker.test')).toBe(false);
    expect(policy.isAllowed('https://power-budgetXpages.dev')).toBe(false);
    expect(policy.isAllowed(undefined)).toBe(false);
  });

  it('matches exact origins only verbatim', () => {
    const policy = parseCorsOrigins('https://power-budget.pages.dev');

    expect(policy.isAllowed('https://power-budget.pages.dev')).toBe(true);
    expect(policy.isAllowed('https://power-budget.pages.dev:443')).toBe(false);
    expect(policy.isAllowed('http://power-budget.pages.dev')).toBe(false);
  });

  it('does not allow credentials (bearer tokens only)', () => {
    expect(buildCorsOptions({ CORS_ORIGINS: 'https://power-budget.pages.dev' }).credentials).toBe(
      false,
    );
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

  it('answers a preview subdomain but not a look-alike host over HTTP', async () => {
    app = await createApp({ CORS_ORIGINS: '*.power-budget.pages.dev' });

    const preview = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://preview-1.power-budget.pages.dev' },
    });
    const lookAlike = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://preview-1.power-budgetXpages.dev' },
    });

    expect(preview.headers['access-control-allow-origin']).toBe(
      'https://preview-1.power-budget.pages.dev',
    );
    expect(lookAlike.headers['access-control-allow-origin']).toBeUndefined();
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

describe('resolveTrustProxy', () => {
  it('defaults to one trusted hop', () => {
    expect(resolveTrustProxy(undefined)).toBe(1);
    expect(resolveTrustProxy('  ')).toBe(1);
  });

  it('parses booleans, hop counts and proxy lists', () => {
    expect(resolveTrustProxy('false')).toBe(false);
    expect(resolveTrustProxy('true')).toBe(true);
    expect(resolveTrustProxy('2')).toBe(2);
    expect(resolveTrustProxy('10.0.0.0/8,127.0.0.1')).toBe('10.0.0.0/8,127.0.0.1');
  });

  it('with the default, request.ip is the address the platform proxy saw, not a spoofed one', async () => {
    const fastify = Fastify({ trustProxy: resolveTrustProxy(undefined) });
    fastify.get('/ip', async (request) => ({ ip: request.ip }));

    const res = await fastify.inject({
      method: 'GET',
      url: '/ip',
      // Client-sent value first, the proxy appends the real client address.
      headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' },
    });
    await fastify.close();

    expect(res.json()).toEqual({ ip: '203.0.113.7' });
  });
});
