import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  renderHeadersFile,
} from './securityHeaders.js';

function directive(csp: string, name: string): string {
  return csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
}

describe('security headers', () => {
  it('lets the production build call only itself, the API origin and Sentry', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'https://api.power-budget.app/v1',
      sentryDsn: 'https://key@o1.ingest.sentry.io/42',
      dev: false,
    });

    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://api.power-budget.app https://o1.ingest.sentry.io",
    );
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('allows the dev server inline refresh script, HMR socket and the local API', () => {
    const csp = buildContentSecurityPolicy({ apiUrl: 'http://localhost:3000', dev: true });

    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' http://localhost:3000 ws: wss:");
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'unsafe-inline'");
  });

  it('renders a Cloudflare Pages _headers file for every path', () => {
    const file = renderHeadersFile(
      buildSecurityHeaders({ apiUrl: 'https://api.example.com', dev: false }),
    );

    expect(file.split('\n')[0]).toBe('/*');
    expect(file).toContain("  Content-Security-Policy: default-src 'self'; script-src 'self'; ");
    expect(file).toContain('  X-Content-Type-Options: nosniff\n');
    expect(file).toContain('  X-Frame-Options: DENY\n');
  });
});
