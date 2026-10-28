import { resolveEmailConfig } from '../infrastructure/notifications/email-config.js';
import { parseCorsOrigins, resolveTrustProxy } from '../bootstrap/http-security.js';
import { resolveJwtSecret } from '../infrastructure/auth/jwt-secret.js';

/**
 * One typed, validated view of the process environment, shared by the API and the
 * worker (CLN-065 / audit ARCH-10). Defaults mirror the values the modules used
 * before, so parsing changes no runtime behaviour; it only fails fast, with every
 * problem listed, when the environment is wrong.
 */
export type AppRole = 'api' | 'worker';

export interface AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly startWorker: boolean;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly jwtSecret: string;
  readonly kekBase64: string;
  readonly corsOrigins: string;
  readonly swaggerEnabled: boolean;
  readonly trustProxy: boolean | string;
  readonly appBaseUrl: string;
  readonly resendApiKey: string;
  readonly emailFrom: string;
  readonly resendWebhookSecret: string | null;
  readonly auditRedactionThresholdMinor: bigint;
  readonly wiseApiBaseUrl: string;
  /** @deprecated GoCardless is legacy; removed with BNK-008. */
  readonly gocardlessSecretId: string;
  /** @deprecated GoCardless is legacy; removed with BNK-008. */
  readonly gocardlessSecretKey: string;
  readonly sentryDsn: string | null;
  readonly sentryRelease: string | null;
}

export type AppEnv = Readonly<Record<string, string | undefined>>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export class InvalidAppConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid environment configuration (see .env.example):\n${problems.map(toBullet).join('\n')}`,
    );
    this.name = 'InvalidAppConfigError';
  }
}

const DEFAULT_DATABASE_URL = 'postgresql://power_budget:power_budget@localhost:5432/power_budget';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_APP_BASE_URL = 'http://localhost:3000';
const DEFAULT_WISE_API_BASE_URL = 'https://api.wise.com';
const DEFAULT_AUDIT_THRESHOLD = '1000000';
const POSTGRES_SCHEMES: readonly string[] = ['postgres:', 'postgresql:'];
const REDIS_SCHEMES: readonly string[] = ['redis:', 'rediss:'];
const HTTP_SCHEMES: readonly string[] = ['http:', 'https:'];
const KEK_BYTES = 32;
const MAX_PORT = 65535;

export function parseAppConfig(env: AppEnv, role: AppRole): AppConfig {
  const problems: string[] = [];
  const nodeEnv = text(env['NODE_ENV']) ?? 'development';
  const jwtSecret = attempt(
    () => resolveJwtSecret(secret(env['JWT_SECRET']) ?? undefined, nodeEnv),
    '',
    problems,
  );
  const kekBase64 = secret(env['KEK_BASE64']) ?? '';
  if (Buffer.from(kekBase64, 'base64').length !== KEK_BYTES) {
    problems.push(
      `KEK_BASE64 must be ${KEK_BYTES} random bytes, base64-encoded (for example \`openssl rand -base64 32\`).`,
    );
  }
  const port = parsePort(env['PORT'], problems);
  const startWorker = parseBoolean('START_WORKER', env['START_WORKER'], problems);
  const swaggerEnabled = parseBoolean('SWAGGER_ENABLED', env['SWAGGER_ENABLED'], problems);
  const databaseUrl = parseUrl(
    'DATABASE_URL',
    env['DATABASE_URL'],
    DEFAULT_DATABASE_URL,
    POSTGRES_SCHEMES,
    problems,
  );
  const redisUrl = parseUrl(
    'REDIS_URL',
    env['REDIS_URL'],
    DEFAULT_REDIS_URL,
    REDIS_SCHEMES,
    problems,
  );
  const appBaseUrl = parseUrl(
    'APP_BASE_URL',
    env['APP_BASE_URL'],
    DEFAULT_APP_BASE_URL,
    HTTP_SCHEMES,
    problems,
  );
  const wiseApiBaseUrl = parseUrl(
    'WISE_API_BASE_URL',
    env['WISE_API_BASE_URL'],
    DEFAULT_WISE_API_BASE_URL,
    HTTP_SCHEMES,
    problems,
  );
  const threshold = parseThreshold(env['AUDIT_REDACTION_THRESHOLD_MINOR'], problems);
  attempt(() => parseCorsOrigins(env['CORS_ORIGINS']), null, problems);
  const email =
    role === 'worker'
      ? attempt(
          () =>
            resolveEmailConfig({
              RESEND_API_KEY: env['RESEND_API_KEY'],
              EMAIL_FROM: env['EMAIL_FROM'],
              NODE_ENV: nodeEnv,
            }),
          { resendApiKey: '', from: '' },
          problems,
        )
      : { resendApiKey: text(env['RESEND_API_KEY']) ?? '', from: text(env['EMAIL_FROM']) ?? '' };

  if (problems.length > 0) {
    throw new InvalidAppConfigError(problems);
  }

  return {
    nodeEnv,
    port,
    startWorker,
    databaseUrl,
    redisUrl,
    jwtSecret,
    kekBase64,
    corsOrigins: env['CORS_ORIGINS'] ?? '',
    swaggerEnabled,
    trustProxy: resolveTrustProxy(env['TRUST_PROXY']),
    appBaseUrl,
    resendApiKey: email.resendApiKey,
    emailFrom: email.from,
    resendWebhookSecret: secret(env['RESEND_WEBHOOK_SECRET']),
    auditRedactionThresholdMinor: threshold,
    wiseApiBaseUrl,
    gocardlessSecretId: secret(env['GOCARDLESS_SECRET_ID']) ?? '',
    gocardlessSecretKey: secret(env['GOCARDLESS_SECRET_KEY']) ?? '',
    sentryDsn: text(env['SENTRY_DSN']),
    sentryRelease: text(env['SENTRY_RELEASE']),
  };
}

function attempt<T, F>(run: () => T, fallback: F, problems: string[]): T | F {
  try {
    return run();
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));

    return fallback;
  }
}

function toBullet(problem: string): string {
  return `  - ${problem}`;
}

/** A secret is validated on its trimmed copy but used byte-for-byte as given. */
function secret(raw: string | undefined): string | null {
  return text(raw) === null ? null : (raw ?? null);
}

function text(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();

  return value === '' ? null : value;
}

function parseBoolean(name: string, raw: string | undefined, problems: string[]): boolean {
  const value = text(raw);
  if (value === null || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  problems.push(`${name} must be "true" or "false", got "${value}".`);

  return false;
}

function parsePort(raw: string | undefined, problems: string[]): number {
  const value = text(raw);
  if (value === null) {
    return 3000;
  }
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > MAX_PORT) {
    problems.push(`PORT must be an integer between 1 and ${MAX_PORT}, got "${value}".`);

    return 3000;
  }

  return port;
}

function parseUrl(
  name: string,
  raw: string | undefined,
  fallback: string,
  schemes: readonly string[],
  problems: string[],
): string {
  const value = text(raw);
  if (value === null) {
    return fallback;
  }
  if (!URL.canParse(value)) {
    // Never echo the value: a DB/Redis URL can embed credentials.
    problems.push(`${name} must be a valid URL.`);

    return fallback;
  }
  if (!schemes.includes(new URL(value).protocol)) {
    problems.push(`${name} must use one of the schemes: ${schemes.join(' ')}.`);

    return fallback;
  }

  return value;
}

function parseThreshold(raw: string | undefined, problems: string[]): bigint {
  const value = text(raw) ?? DEFAULT_AUDIT_THRESHOLD;
  if (!/^\d+$/.test(value)) {
    problems.push(
      `AUDIT_REDACTION_THRESHOLD_MINOR must be a non-negative integer, got "${value}".`,
    );

    return BigInt(DEFAULT_AUDIT_THRESHOLD);
  }

  return BigInt(value);
}
