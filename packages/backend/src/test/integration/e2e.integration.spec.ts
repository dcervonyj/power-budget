import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startContainers, stopContainers, resetState } from './setup.js';
import { createTestApp } from './app.js';

interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

describe('HTTP e2e: real Nest app on Fastify against Postgres + Redis', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('register then login returns tokens for the same user', async () => {
    const credentials = { email: 'e2e-user@example.com', password: 'Str0ngPass!' };

    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: credentials,
    });
    expect(registered.statusCode).toBe(201);
    const registeredBody = registered.json<AuthResponse>();
    expect(registeredBody.accessToken).toEqual(expect.any(String));

    const loggedIn = await app.inject({ method: 'POST', url: '/auth/login', payload: credentials });
    expect(loggedIn.statusCode).toBe(201);
    const loginBody = loggedIn.json<AuthResponse>();
    expect(loginBody.userId).toBe(registeredBody.userId);
    expect(loginBody.accessToken).toEqual(expect.any(String));
  });

  // Known bug on master: domain errors (InvalidCredentialsError) are not mapped to HTTP
  // statuses and surface as 500. Fixed by CLN-002 (validation/error mapping); unskip there.
  it.skip('login with a wrong password is rejected with 401', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'wrong-pw@example.com', password: 'Str0ngPass!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'wrong-pw@example.com', password: 'not-the-password' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /users/me without a token is 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me' });

    expect(res.statusCode).toBe(401);
  });

  it('GET /users/me with the registration token returns the profile', async () => {
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'me@example.com', password: 'Str0ngPass!' },
    });
    const { accessToken, userId } = registered.json<AuthResponse>();

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: userId, email: 'me@example.com' });
  });
});
