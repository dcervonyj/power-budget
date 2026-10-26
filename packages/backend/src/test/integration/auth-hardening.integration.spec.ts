import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import Redis from 'ioredis';
import { generateSync } from 'otplib';
import { startContainers, stopContainers, resetState, getPool } from './setup.js';
import { createTestApp } from './app.js';

interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

interface Enrolment {
  secret: string;
  qrCodeUri: string;
}

const PASSWORD = 'Str0ngPass!';
const TOTP_PERIOD_SECONDS = 30;

/** A code for the current step (`stepOffset` 0) or the next one (1). */
function totpCode(secret: string, stepOffset = 0): string {
  return generateSync({
    secret,
    epoch: Math.floor(Date.now() / 1000) + stepOffset * TOTP_PERIOD_SECONDS,
  });
}

function householdIdOf(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    householdId: string;
  };

  return claims.householdId;
}

/** 1..count, for sequential request loops. */
function attemptNumbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function statusesOf(responses: LightMyRequestResponse[]): number[] {
  return responses.map((res) => res.statusCode).sort();
}

/**
 * CLN-004 (audit C7, H4, H5, H6, M9, C3 step-up): the real AppModule on
 * Fastify against Postgres + Redis.
 */
describe('HTTP auth hardening (real app)', () => {
  let app: NestFastifyApplication;
  let redis: Redis;

  beforeAll(async () => {
    const containers = await startContainers();
    redis = new Redis(containers.redisUrl);
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    redis?.disconnect();
    await app?.close();
    await stopContainers();
  });

  async function register(email: string): Promise<AuthResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);

    return res.json<AuthResponse>();
  }

  async function enrol(accessToken: string): Promise<Enrolment> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/totp/enable',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(201);

    return res.json<Enrolment>();
  }

  function verifyTotp(accessToken: string, code: string): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/auth/totp/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code },
    });
  }

  /** Registers a user and enables TOTP (code of the current step used). */
  async function registerWithTotp(email: string): Promise<AuthResponse & Enrolment> {
    const user = await register(email);
    const enrolment = await enrol(user.accessToken);
    const verified = await verifyTotp(user.accessToken, totpCode(enrolment.secret));
    expect(verified.statusCode).toBe(204);

    return { ...user, ...enrolment };
  }

  async function insertMagicLink(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await getPool().query(
      'INSERT INTO magic_link_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, new Date(Date.now() + 15 * 60_000)],
    );

    return token;
  }

  function consumeMagicLink(token: string, totp?: string): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/auth/magic-link/consume',
      payload: totp === undefined ? { token } : { token, totp },
    });
  }

  function login(
    email: string,
    password: string,
    options: { totp?: string; remoteAddress?: string } = {},
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/auth/login',
      payload:
        options.totp === undefined ? { email, password } : { email, password, totp: options.totp },
      remoteAddress: options.remoteAddress,
    });
  }

  describe('TOTP enrolment (audit C7, H5)', () => {
    it('a fresh user can enrol without any step-up and verify the first code', async () => {
      const user = await register('fresh@example.com');

      const enrolment = await enrol(user.accessToken);
      const verified = await verifyTotp(user.accessToken, totpCode(enrolment.secret));

      expect(enrolment.qrCodeUri).toMatch(/^otpauth:\/\/totp\/PowerBudget:/);
      expect(verified.statusCode).toBe(204);
      const row = await getPool().query<{ verified_at: Date | null }>(
        'SELECT verified_at FROM totp_secrets WHERE user_id = $1',
        [user.userId],
      );
      expect(row.rows[0]?.verified_at).toBeInstanceOf(Date);
    });

    it('stores the secret only as Encryption-port ciphertext', async () => {
      const user = await register('cipher@example.com');
      const enrolment = await enrol(user.accessToken);

      const row = await getPool().query<{ encrypted_secret: string }>(
        'SELECT encrypted_secret FROM totp_secrets WHERE user_id = $1',
        [user.userId],
      );
      const stored = row.rows[0]?.encrypted_secret ?? '';

      expect(stored.startsWith('env-v1:aes-256-gcm:')).toBe(true);
      expect(stored).not.toContain(enrolment.secret);
    });

    it('replacing an enabled TOTP needs a recent step-up', async () => {
      const user = await registerWithTotp('reenrol@example.com');
      await redis.del(`totp-stepup:${user.userId}`);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/totp/enable',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ code: 'requires_totp' });
    });
  });

  describe('TOTP replacement keeps 2FA on (BE-BUGS-01)', () => {
    it('an abandoned replacement still demands a code from the current secret', async () => {
      const user = await registerWithTotp('abandon@example.com');
      const replacement = await enrol(user.accessToken);

      const withoutCode = await login('abandon@example.com', PASSWORD);
      const withNewCode = await login('abandon@example.com', PASSWORD, {
        totp: totpCode(replacement.secret, 1),
      });
      const withOldCode = await login('abandon@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });

      expect(withoutCode.statusCode).toBe(403);
      expect(withoutCode.json()).toMatchObject({ code: 'requires_totp' });
      expect(withNewCode.statusCode).toBe(401);
      expect(withOldCode.statusCode).toBe(201);
    });

    it('a confirmed replacement switches secrets and the old secret stops working', async () => {
      const user = await registerWithTotp('replace@example.com');
      const replacement = await enrol(user.accessToken);

      const confirmed = await verifyTotp(user.accessToken, totpCode(replacement.secret));
      const withOldCode = await login('replace@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });
      const withNewCode = await login('replace@example.com', PASSWORD, {
        totp: totpCode(replacement.secret, 1),
      });

      expect(confirmed.statusCode).toBe(204);
      expect(withOldCode.statusCode).toBe(401);
      expect(withNewCode.statusCode).toBe(201);
      const row = await getPool().query<{ pending_encrypted_secret: string | null }>(
        'SELECT pending_encrypted_secret FROM totp_secrets WHERE user_id = $1',
        [user.userId],
      );
      expect(row.rows[0]?.pending_encrypted_secret).toBeNull();
    });

    it('restarting a replacement keeps the current secret and drops the earlier pending one', async () => {
      const user = await registerWithTotp('restart@example.com');
      const first = await enrol(user.accessToken);
      const second = await enrol(user.accessToken);

      const withoutCode = await login('restart@example.com', PASSWORD);
      const withFirst = await verifyTotp(user.accessToken, totpCode(first.secret));
      const withOldCode = await login('restart@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });
      const confirmed = await verifyTotp(user.accessToken, totpCode(second.secret, 1));

      expect(withoutCode.statusCode).toBe(403);
      expect(withFirst.statusCode).toBe(401);
      expect(withOldCode.statusCode).toBe(201);
      expect(confirmed.statusCode).toBe(204);
    });
  });

  describe('TOTP replay protection (audit M9)', () => {
    it('rejects a code that was already accepted', async () => {
      const user = await register('replay@example.com');
      const enrolment = await enrol(user.accessToken);
      const code = totpCode(enrolment.secret);

      const first = await verifyTotp(user.accessToken, code);
      const replayed = await verifyTotp(user.accessToken, code);

      expect(first.statusCode).toBe(204);
      expect(replayed.statusCode).toBe(401);
      expect(replayed.json()).toMatchObject({ code: 'totp_invalid' });
    });

    it('accepts the same code only once when sent concurrently', async () => {
      const user = await register('replay-race@example.com');
      const enrolment = await enrol(user.accessToken);
      const code = totpCode(enrolment.secret);

      const responses = await Promise.all([
        verifyTotp(user.accessToken, code),
        verifyTotp(user.accessToken, code),
      ]);

      expect(statusesOf(responses)).toEqual([204, 401]);
    });
  });

  describe('one login policy (audit H6)', () => {
    it('password login demands TOTP once it is enabled', async () => {
      const user = await registerWithTotp('pw-totp@example.com');

      const withoutCode = await login('pw-totp@example.com', PASSWORD);
      const withCode = await login('pw-totp@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });

      expect(withoutCode.statusCode).toBe(403);
      expect(withoutCode.json()).toMatchObject({ code: 'requires_totp' });
      expect(withCode.statusCode).toBe(201);
      expect(withCode.json<AuthResponse>().userId).toBe(user.userId);
    });

    it('magic-link login demands TOTP once it is enabled, without burning the link', async () => {
      const user = await registerWithTotp('ml-totp@example.com');
      const token = await insertMagicLink(user.userId);

      const withoutCode = await consumeMagicLink(token);
      const wrongCode = await consumeMagicLink(token, '000000');
      const withCode = await consumeMagicLink(token, totpCode(user.secret, 1));
      const again = await consumeMagicLink(token, totpCode(user.secret, 1));

      expect(withoutCode.statusCode).toBe(403);
      expect(withoutCode.json()).toMatchObject({ code: 'requires_totp' });
      expect(wrongCode.statusCode).toBe(401);
      expect(withCode.statusCode).toBe(201);
      expect(withCode.json<AuthResponse>().userId).toBe(user.userId);
      expect(again.statusCode).toBe(401);
      expect(again.json()).toMatchObject({ code: 'magic_link_expired' });
    });

    it('magic-link login without TOTP enabled needs no code', async () => {
      const user = await register('ml-plain@example.com');
      const token = await insertMagicLink(user.userId);

      const res = await consumeMagicLink(token);

      expect(res.statusCode).toBe(201);
    });
  });

  describe('atomic tokens (audit M9)', () => {
    it('of two concurrent refreshes with the same token exactly one wins', async () => {
      const user = await register('refresh-race@example.com');

      const responses = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: user.refreshToken },
        }),
        app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: user.refreshToken },
        }),
      ]);

      expect(statusesOf(responses)).toEqual([201, 401]);
    });

    it('of two concurrent magic-link consumes exactly one gets a session', async () => {
      const user = await register('ml-race@example.com');
      const token = await insertMagicLink(user.userId);

      const responses = await Promise.all([consumeMagicLink(token), consumeMagicLink(token)]);

      expect(statusesOf(responses)).toEqual([201, 401]);
    });
  });

  describe('rate limits (audit H4)', () => {
    it('limits login attempts per email, whatever the client IP', async () => {
      await register('target@example.com');
      const statuses: number[] = [];
      for (const attempt of attemptNumbers(11)) {
        const res = await login('target@example.com', 'wrong-password', {
          remoteAddress: `198.51.100.${attempt}`,
        });
        statuses.push(res.statusCode);
      }

      expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 401));
      expect(statuses[10]).toBe(429);
    });

    it('limits login attempts per IP, whatever the email', async () => {
      const statuses: number[] = [];
      for (const attempt of attemptNumbers(21)) {
        const res = await login(`nobody-${attempt}@example.com`, 'wrong-password', {
          remoteAddress: '203.0.113.50',
        });
        statuses.push(res.statusCode);
      }
      const otherIp = await login('nobody-x@example.com', 'wrong-password', {
        remoteAddress: '203.0.113.51',
      });

      expect(statuses.slice(0, 20)).toEqual(Array.from({ length: 20 }, () => 401));
      expect(statuses[20]).toBe(429);
      expect(otherIp.statusCode).toBe(401);
    });

    it('returns 429 with Retry-After and a too_many_requests code', async () => {
      for (const attempt of attemptNumbers(10)) {
        await app.inject({
          method: 'POST',
          url: '/auth/magic-link/request',
          payload: { email: 'flood@example.com' },
          remoteAddress: `192.0.2.${attempt}`,
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/auth/magic-link/request',
        payload: { email: 'flood@example.com' },
        remoteAddress: '192.0.2.99',
      });

      expect(res.statusCode).toBe(429);
      expect(res.headers['retry-after-account']).toBeDefined();
      expect(res.json()).toMatchObject({ statusCode: 429, code: 'too_many_requests' });
    });

    it('limits TOTP verify attempts per user', async () => {
      const user = await register('totp-brute@example.com');
      await enrol(user.accessToken);
      const statuses: number[] = [];
      for (const attempt of attemptNumbers(11)) {
        const res = await app.inject({
          method: 'POST',
          url: '/auth/totp/verify',
          headers: { authorization: `Bearer ${user.accessToken}` },
          payload: { code: '000000' },
          remoteAddress: `198.51.100.${100 + attempt}`,
        });
        statuses.push(res.statusCode);
      }

      expect(statuses[10]).toBe(429);
    });
  });

  describe('per-user second-factor lockout (BE-BUGS-02)', () => {
    const IPS = ['203.0.113.10', '203.0.113.11'];

    function consumeFrom(
      token: string,
      totp: string,
      remoteAddress: string,
    ): Promise<LightMyRequestResponse> {
      return app.inject({
        method: 'POST',
        url: '/auth/magic-link/consume',
        payload: { token, totp },
        remoteAddress,
      });
    }

    it('25 wrong codes on magic links from 2 IPs lock the user out, password login included', async () => {
      const user = await registerWithTotp('ml-brute@example.com');
      const responses: LightMyRequestResponse[] = [];
      for (const attempt of attemptNumbers(25)) {
        const token = await insertMagicLink(user.userId);
        responses.push(await consumeFrom(token, '000000', IPS[attempt % 2] ?? ''));
      }
      const correctWhileLocked = await login('ml-brute@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });

      const statuses = responses.map((res) => res.statusCode);
      expect(statuses.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => 401));
      expect(statuses.slice(5)).toEqual(Array.from({ length: 20 }, () => 429));
      const locked = responses[24];
      expect(locked?.json()).toMatchObject({ statusCode: 429, code: 'too_many_requests' });
      expect(Number(locked?.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(locked?.headers['retry-after'])).toBeLessThanOrEqual(15 * 60);
      expect(correctWhileLocked.statusCode).toBe(429);
    });

    it('accepts a correct code once the lockout window has passed', async () => {
      const user = await registerWithTotp('ml-unlock@example.com');
      for (const attempt of attemptNumbers(6)) {
        await login('ml-unlock@example.com', PASSWORD, {
          totp: '000000',
          remoteAddress: IPS[attempt % 2],
        });
      }
      const lockedOut = await login('ml-unlock@example.com', PASSWORD, {
        totp: totpCode(user.secret, 1),
      });
      // The window is a Redis TTL: let it run out.
      await redis.pexpire(`attempts:totp-failures:${user.userId}`, 1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const token = await insertMagicLink(user.userId);

      const afterWindow = await consumeMagicLink(token, totpCode(user.secret, 1));

      expect(lockedOut.statusCode).toBe(429);
      expect(afterWindow.statusCode).toBe(201);
      expect(afterWindow.json<AuthResponse>().userId).toBe(user.userId);
    });

    it('burns the magic link after 3 wrong codes', async () => {
      const user = await registerWithTotp('ml-burn@example.com');
      const token = await insertMagicLink(user.userId);
      const statuses: number[] = [];
      for (const attempt of attemptNumbers(3)) {
        const res = await consumeFrom(token, '000000', IPS[attempt % 2] ?? '');
        statuses.push(res.statusCode);
      }

      const withCode = await consumeMagicLink(token, totpCode(user.secret, 1));

      expect(statuses).toEqual([401, 401, 401]);
      expect(withCode.statusCode).toBe(401);
      expect(withCode.json()).toMatchObject({ code: 'magic_link_expired' });
    });
  });

  describe('household delete step-up', () => {
    it('needs TOTP enrolment, then a recent TOTP verification', async () => {
      const user = await register('owner@example.com');
      const householdId = householdIdOf(user.accessToken);
      const deleteHousehold = (): Promise<LightMyRequestResponse> =>
        app.inject({
          method: 'DELETE',
          url: `/households/${householdId}`,
          headers: { authorization: `Bearer ${user.accessToken}` },
        });

      const notEnrolled = await deleteHousehold();
      const enrolment = await enrol(user.accessToken);
      expect((await verifyTotp(user.accessToken, totpCode(enrolment.secret))).statusCode).toBe(204);
      await redis.del(`totp-stepup:${user.userId}`);
      const stale = await deleteHousehold();
      expect((await verifyTotp(user.accessToken, totpCode(enrolment.secret, 1))).statusCode).toBe(
        204,
      );
      const stepped = await deleteHousehold();

      expect(notEnrolled.statusCode).toBe(403);
      expect(notEnrolled.json()).toMatchObject({ code: 'requires_totp_enrollment' });
      expect(stale.statusCode).toBe(403);
      expect(stale.json()).toMatchObject({ code: 'requires_totp' });
      expect(stepped.statusCode).toBe(202);
    });
  });
});
