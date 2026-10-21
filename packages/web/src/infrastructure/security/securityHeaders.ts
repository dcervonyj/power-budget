/**
 * HTTP security headers for the web app (audit M20). Pure: used by vite.config.ts
 * for the dev/preview servers and to generate `dist/_headers` (Cloudflare Pages).
 */
export interface SecurityHeaderOptions {
  /** VITE_API_URL; its origin is the only API the app may call. */
  readonly apiUrl: string;
  /** VITE_SENTRY_DSN, when error reporting is on. */
  readonly sentryDsn?: string | undefined;
  /** The Vite dev server needs inline scripts (React refresh) and a websocket (HMR). */
  readonly dev: boolean;
}

export type SecurityHeaders = Readonly<Record<string, string>>;

export function originOf(url: string): string {
  return new URL(url).origin;
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions): string {
  const connectSources = ["'self'", originOf(options.apiUrl)];
  if (options.sentryDsn) {
    connectSources.push(originOf(options.sentryDsn));
  }
  const scriptSources = ["'self'"];
  if (options.dev) {
    scriptSources.push("'unsafe-inline'");
    connectSources.push('ws:', 'wss:');
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${unique(connectSources).join(' ')}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): SecurityHeaders {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/** Cloudflare Pages `_headers` file: the headers apply to every path. */
export function renderHeadersFile(headers: SecurityHeaders): string {
  const lines = Object.entries(headers).map(formatHeaderLine);

  return ['/*', ...lines, ''].join('\n');
}

function formatHeaderLine([name, value]: [string, string]): string {
  return `  ${name}: ${value}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
