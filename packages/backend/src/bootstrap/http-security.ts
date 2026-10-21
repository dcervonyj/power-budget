import type { INestApplication } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
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

const SUBDOMAIN_WILDCARD = /^\*\.([a-z0-9-]+(\.[a-z0-9-]+)+)$/;

/** Fails fast on configuration that would make the API insecure. */
export function assertBootEnv(env: HttpSecurityEnv): void {
  resolveJwtSecret(env.JWT_SECRET, env.NODE_ENV);
  buildCorsOptions(env);
}

/** Swagger UI and /docs-json are served only when SWAGGER_ENABLED=true. */
export function isSwaggerEnabled(env: HttpSecurityEnv): boolean {
  return env.SWAGGER_ENABLED === 'true';
}

/**
 * CORS comes from CORS_ORIGINS only. No entry means no cross-origin access.
 * A bare "*" or any other wildcard form is rejected at boot.
 */
export function parseCorsOrigins(raw: string | undefined): Array<string | RegExp> {
  return (raw ?? '').split(',').map(trimOrigin).filter(isNonEmpty).map(toCorsOrigin);
}

export function buildCorsOptions(env: HttpSecurityEnv): FastifyCorsOptions {
  const origins = parseCorsOrigins(env.CORS_ORIGINS);

  return {
    origin: origins.length > 0 ? origins : false,
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

function toCorsOrigin(origin: string): string | RegExp {
  const wildcard = SUBDOMAIN_WILDCARD.exec(origin);
  if (wildcard !== null) {
    const domain = (wildcard[1] ?? '').replaceAll('.', '\\.');

    return new RegExp(`^https://[a-z0-9-]+\\.${domain}$`);
  }
  if (origin.includes('*') || !isExactOrigin(origin)) {
    throw new InvalidCorsOriginError(origin);
  }

  return origin;
}

function isExactOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === origin;
  } catch {
    return false;
  }
}
