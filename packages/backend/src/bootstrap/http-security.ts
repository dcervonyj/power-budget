import type { INestApplication } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import cors, { type AsyncOriginFunction, type FastifyCorsOptions } from '@fastify/cors';
import helmet from '@fastify/helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { resolveJwtSecret } from '../infrastructure/auth/jwt-secret.js';

/**
 * HTTP hardening shared by main.ts and the HTTP tests (CLN-001 / audit C1, L1, L2).
 */
export interface HttpSecurityEnv {
  readonly NODE_ENV?: string;
  readonly JWT_SECRET?: string;
  readonly CORS_ORIGINS?: string;
  readonly SWAGGER_ENABLED?: string;
  readonly TRUST_PROXY?: string;
}

export class InvalidCorsOriginError extends Error {
  constructor(origin: string) {
    super(
      `CORS_ORIGINS entry "${origin}" is not allowed. Use exact origins ` +
        '(https://app.example.com) or "*.example.com" for direct HTTPS subdomains.',
    );
    this.name = 'InvalidCorsOriginError';
  }
}

const WILDCARD_PREFIX = '*.';
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type CorsOriginRule =
  | { readonly kind: 'exact'; readonly origin: string }
  | { readonly kind: 'subdomain'; readonly domain: string };

/**
 * Matches request origins against CORS_ORIGINS without building any RegExp
 * from configuration. `*.domain` allows exactly one extra DNS label over
 * HTTPS on the default port; everything else must match an exact origin.
 */
export class CorsOriginPolicy {
  constructor(readonly rules: readonly CorsOriginRule[]) {}

  isAllowed(origin: string | undefined): boolean {
    if (origin === undefined) {
      return false;
    }
    for (const rule of this.rules) {
      if (this.matches(rule, origin)) {
        return true;
      }
    }

    return false;
  }

  private matches(rule: CorsOriginRule, origin: string): boolean {
    if (rule.kind === 'exact') {
      return origin === rule.origin;
    }
    const url = parseUrl(origin);
    if (url === null || url.origin !== origin || url.protocol !== 'https:' || url.port !== '') {
      return false;
    }
    const suffix = `.${rule.domain}`;
    if (!url.hostname.endsWith(suffix)) {
      return false;
    }

    return DNS_LABEL.test(url.hostname.slice(0, -suffix.length));
  }
}

/** Fails fast on configuration that would make the API insecure. */
export function assertBootEnv(env: HttpSecurityEnv): void {
  resolveJwtSecret(env.JWT_SECRET, env.NODE_ENV);
  buildCorsOptions(env);
}

/** Fastify `trustProxy` value: `false`, `true`, a hop count, or a comma-separated list of proxy IPs/CIDRs. */
export type TrustProxySetting = boolean | number | string;

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * TRUST_PROXY decides which X-Forwarded-For entry becomes `request.ip`, the
 * key of the per-IP rate limit (audit H4). Default: one hop, the platform load
 * balancer (Render). `true` would trust every hop, so any client could pick its
 * own IP by sending X-Forwarded-For; use it only behind a proxy that strips it.
 */
export function resolveTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();
  if (value.length === 0) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}

/** Swagger UI and /docs-json are served only when SWAGGER_ENABLED=true. */
export function isSwaggerEnabled(env: HttpSecurityEnv): boolean {
  return env.SWAGGER_ENABLED === 'true';
}

/**
 * CORS comes from CORS_ORIGINS only. No entry means no cross-origin access.
 * A bare "*" or any other wildcard form is rejected at boot.
 */
export function parseCorsOrigins(raw: string | undefined): CorsOriginPolicy {
  return new CorsOriginPolicy(
    (raw ?? '').split(',').map(trimOrigin).filter(isNonEmpty).map(toCorsOriginRule),
  );
}

export function buildCorsOptions(env: HttpSecurityEnv): FastifyCorsOptions {
  const policy = parseCorsOrigins(env.CORS_ORIGINS);

  return {
    origin: policy.rules.length > 0 ? toOriginFunction(policy) : false,
    // Bearer tokens travel in the Authorization header, never in cookies.
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  };
}

export async function configureHttpSecurity(
  nestApp: INestApplication,
  env: HttpSecurityEnv,
): Promise<void> {
  const fastify: FastifyInstance = nestApp.getHttpAdapter().getInstance();

  if (isSwaggerEnabled(env)) {
    const config = new DocumentBuilder()
      .setTitle('Power Budget API')
      .setVersion('1.0')
      .setOpenAPIVersion('3.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(nestApp, config);
    SwaggerModule.setup('docs', nestApp, document);
  }

  await fastify.register(cors, buildCorsOptions(env));

  await fastify.register(helmet, {
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
}

function trimOrigin(origin: string): string {
  return origin.trim();
}

function isNonEmpty(origin: string): boolean {
  return origin.length > 0;
}

function toCorsOriginRule(origin: string): CorsOriginRule {
  if (origin.startsWith(WILDCARD_PREFIX)) {
    const domain = origin.slice(WILDCARD_PREFIX.length);
    if (!isDomainName(domain)) {
      throw new InvalidCorsOriginError(origin);
    }

    return { kind: 'subdomain', domain };
  }
  if (origin.includes('*') || !isExactOrigin(origin)) {
    throw new InvalidCorsOriginError(origin);
  }

  return { kind: 'exact', origin };
}

function isDomainName(domain: string): boolean {
  const labels = domain.split('.');

  return labels.length >= 2 && labels.every(isDnsLabel);
}

function isDnsLabel(label: string): boolean {
  return DNS_LABEL.test(label);
}

function toOriginFunction(policy: CorsOriginPolicy): AsyncOriginFunction {
  return async function corsOrigin(origin: string | undefined): Promise<boolean> {
    return policy.isAllowed(origin);
  };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isExactOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === origin;
  } catch {
    return false;
  }
}
