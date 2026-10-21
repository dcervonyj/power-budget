import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthController } from '../AuthController.js';
import { createHttpTestApp, type HttpTestApp } from '../../../test/http/createHttpTestApp.js';

describe('Google OAuth routes (HTTP)', () => {
  let app: HttpTestApp;

  beforeEach(async () => {
    app = await createHttpTestApp({ controllers: [AuthController] });
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /auth/oauth/google/start is not served', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/oauth/google/start' });

    expect(res.statusCode).toBe(404);
  });

  it('GET /auth/oauth/google/callback cannot mint tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/oauth/google/callback?code=anything&state=anything',
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('accessToken');
  });
});
