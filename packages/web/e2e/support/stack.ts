/**
 * Addresses of the e2e stack (CLN-017). Postgres and Redis come from
 * docker/e2e/docker-compose.yml; the fake Resend API, the backend
 * (scripts/e2e-backend.sh, same ports) and the web preview are started by
 * playwright.config.ts (webServer).
 */
/** True when the full stack is up (CI e2e job, or `pnpm test:e2e:stack` locally). */
export const FULL_STACK = process.env['TEST_ENV'] === 'e2e';

export const STACK = {
  // The e2e web preview; without the stack, the smoke specs target `pnpm dev`.
  webUrl:
    process.env['BASE_URL'] ?? (FULL_STACK ? 'http://localhost:4173' : 'http://localhost:5173'),
  apiUrl: process.env['E2E_API_URL'] ?? 'http://localhost:3100',
  fakeResendUrl: process.env['E2E_FAKE_RESEND_URL'] ?? 'http://localhost:3901',
} as const;
