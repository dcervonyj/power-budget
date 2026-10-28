import { describe, expect, it } from 'vitest';
import { InvalidAppConfigError, parseAppConfig, type AppEnv } from '../AppConfig.js';

const KEK = Buffer.alloc(32, 7).toString('base64');
const JWT = 'a-jwt-secret-that-is-longer-than-32-bytes-ok';
const VALID: AppEnv = { NODE_ENV: 'development', JWT_SECRET: JWT, KEK_BASE64: KEK };

function problemsOf(env: AppEnv, role: 'api' | 'worker'): string {
  try {
    parseAppConfig(env, role);
  } catch (error) {
    if (error instanceof InvalidAppConfigError) {
      return error.message;
    }
    throw error;
  }

  return '';
}

describe('parseAppConfig', () => {
  it('applies the previous defaults when only the required keys are set', () => {
    const config = parseAppConfig(VALID, 'api');

    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      startWorker: false,
      swaggerEnabled: false,
      databaseUrl: 'postgresql://power_budget:power_budget@localhost:5432/power_budget',
      redisUrl: 'redis://localhost:6379',
      appBaseUrl: 'http://localhost:3000',
      wiseApiBaseUrl: 'https://api.wise.com',
      auditRedactionThresholdMinor: 1000000n,
      jwtSecret: JWT,
      gocardlessSecretId: '',
      sentryDsn: null,
    });
  });

  it('reads explicit values', () => {
    const config = parseAppConfig(
      {
        ...VALID,
        PORT: '8080',
        START_WORKER: 'true',
        SWAGGER_ENABLED: 'true',
        REDIS_URL: 'redis://cache:6379',
        AUDIT_REDACTION_THRESHOLD_MINOR: '500',
        TRUST_PROXY: 'false',
      },
      'api',
    );

    expect(config).toMatchObject({
      port: 8080,
      startWorker: true,
      swaggerEnabled: true,
      redisUrl: 'redis://cache:6379',
      auditRedactionThresholdMinor: 500n,
      trustProxy: false,
    });
  });

  it('reports a missing JWT_SECRET and KEK_BASE64 together', () => {
    const message = problemsOf({ NODE_ENV: 'production' }, 'api');

    expect(message).toContain('JWT_SECRET is not set');
    expect(message).toContain('KEK_BASE64 must be 32 random bytes');
  });

  it('requires JWT_SECRET for the worker too (its auth module issues tokens)', () => {
    expect(problemsOf({ KEK_BASE64: KEK }, 'worker')).toContain('JWT_SECRET is not set');
  });

  it('treats empty and blank values as unset: defaults for optional, errors for required', () => {
    const config = parseAppConfig({ ...VALID, DATABASE_URL: '', REDIS_URL: '   ' }, 'api');

    expect(config.databaseUrl).toBe(
      'postgresql://power_budget:power_budget@localhost:5432/power_budget',
    );
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(problemsOf({ ...VALID, JWT_SECRET: '', KEK_BASE64: '  ' }, 'api')).toContain(
      'JWT_SECRET is not set',
    );
  });

  it('never echoes URL or secret values in errors', () => {
    const message = problemsOf(
      {
        ...VALID,
        DATABASE_URL: 'postgres://app:hunter2-secret@bad host/db',
        REDIS_URL: 'redis://:redis-secret@bad host',
        JWT_SECRET: 'jwt-secret-short',
        KEK_BASE64: 'kek-secret',
      },
      'api',
    );

    expect(message).toContain('DATABASE_URL must be a valid URL.');
    expect(message).toContain('REDIS_URL must be a valid URL.');
    for (const leaked of ['hunter2', 'redis-secret', 'jwt-secret-short', 'kek-secret']) {
      expect(message).not.toContain(leaked);
    }
  });

  it('requires RESEND_API_KEY for a deployed worker only', () => {
    const deployed = { KEK_BASE64: KEK, JWT_SECRET: JWT, NODE_ENV: 'production' };

    expect(problemsOf(deployed, 'worker')).toContain('RESEND_API_KEY is required');
    expect(problemsOf({ ...deployed, RESEND_API_KEY: 're_x' }, 'worker')).toBe('');
  });

  it('lists every invalid value', () => {
    const message = problemsOf(
      {
        ...VALID,
        PORT: 'abc',
        START_WORKER: 'yes',
        DATABASE_URL: 'not a url',
        AUDIT_REDACTION_THRESHOLD_MINOR: '-5',
        CORS_ORIGINS: '*',
        JWT_SECRET: 'short',
      },
      'api',
    );

    expect(message).toContain('PORT must be an integer');
    expect(message).toContain('START_WORKER must be "true" or "false", got "yes"');
    expect(message).toContain('DATABASE_URL must be a valid URL');
    expect(message).toContain('AUDIT_REDACTION_THRESHOLD_MINOR must be a non-negative integer');
    expect(message).toContain('CORS_ORIGINS entry "*"');
    expect(message).toContain('JWT_SECRET is shorter than 32 bytes');
  });

  it('rejects a KEK of the wrong length', () => {
    expect(problemsOf({ ...VALID, KEK_BASE64: 'AAAA' }, 'api')).toContain('KEK_BASE64 must be 32');
  });
});
