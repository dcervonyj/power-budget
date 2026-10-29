import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { startContainers, stopContainers, resetState, getPool } from './setup.js';
import { createTestApp } from './app.js';
import { InMemoryBankConnector } from '../../infrastructure/bank/InMemoryBankConnector.js';

const PASSWORD = 'Str0ngPass!';
const FAIL_HOUSEHOLD_TRIGGER = 'cln033_fail_household_insert';

/** 1..count, for sequential request loops. */
function attemptNumbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function statusesOf(responses: LightMyRequestResponse[]): number[] {
  return responses.map((res) => res.statusCode).sort();
}

/**
 * CLN-033 (audit BE-BUGS-12, BE-BUGS-17): registration is throttled and atomic, and the bank
 * catalogue needs a login and is cached. The real AppModule on Fastify against Postgres + Redis.
 */
describe('Registration and bank catalogue hardening (real app)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  function register(email: string, remoteAddress = '127.0.0.1'): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
      remoteAddress,
    });
  }

  async function countUsers(email: string): Promise<number> {
    const result = await getPool().query<{ total: string }>(
      'SELECT count(*) AS total FROM users WHERE lower(email) = lower($1)',
      [email],
    );

    return Number(result.rows[0]?.total ?? '0');
  }

  describe('POST /auth/register', () => {
    it('limits registrations per IP (429 after 20 a minute)', async () => {
      const statuses: number[] = [];
      for (const attempt of attemptNumbers(21)) {
        // No password: a 400 that still counts, so the test needs no argon2 work.
        const res = await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { email: `flood-${attempt}@example.com` },
          remoteAddress: '203.0.113.70',
        });
        statuses.push(res.statusCode);
      }
      const otherIp = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'flood-x@example.com' },
        remoteAddress: '203.0.113.71',
      });

      expect(statuses.slice(0, 20)).toEqual(Array.from({ length: 20 }, () => 400));
      expect(statuses[20]).toBe(429);
      expect(otherIp.statusCode).toBe(400);
    });

    it('answers the 429 in the standard error shape, while normal registrations still get 201 and 409', async () => {
      const ip = '203.0.113.80';
      const created = await register('normal@example.com', ip);
      const duplicate = await register('normal@example.com', ip);
      const flood: LightMyRequestResponse[] = [];
      for (const attempt of attemptNumbers(18)) {
        flood.push(
          await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { email: `shape-${attempt}@example.com` },
            remoteAddress: ip,
          }),
        );
      }
      const limited = await register('over-the-limit@example.com', ip);

      expect(created.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(409);
      expect(flood.map((res) => res.statusCode)).toEqual(attemptNumbers(18).map(() => 400));
      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ statusCode: 429, code: 'too_many_requests' });
    });

    it('leaves no partial rows when a write fails mid-registration', async () => {
      const email = 'half-done@example.com';
      await getPool().query(
        `CREATE FUNCTION ${FAIL_HOUSEHOLD_TRIGGER}() RETURNS trigger LANGUAGE plpgsql AS
         $$ BEGIN RAISE EXCEPTION 'household insert failed'; END $$`,
      );
      await getPool().query(
        `CREATE TRIGGER ${FAIL_HOUSEHOLD_TRIGGER} BEFORE INSERT ON households
         FOR EACH ROW EXECUTE FUNCTION ${FAIL_HOUSEHOLD_TRIGGER}()`,
      );
      try {
        const failed = await register(email);

        expect(failed.statusCode).toBe(500);
        expect(await countUsers(email)).toBe(0);
      } finally {
        await getPool().query(`DROP TRIGGER ${FAIL_HOUSEHOLD_TRIGGER} ON households`);
        await getPool().query(`DROP FUNCTION ${FAIL_HOUSEHOLD_TRIGGER}()`);
      }

      // Nothing was left behind, so the same email can register now.
      const retried = await register(email);
      expect(retried.statusCode).toBe(201);
      expect(await countUsers(email)).toBe(1);
    });

    it('answers 409 to a concurrent duplicate instead of 500', async () => {
      const responses = await Promise.all([
        register('race@example.com', '198.51.100.21'),
        register('RACE@example.com', '198.51.100.22'),
      ]);

      expect(statusesOf(responses)).toEqual([201, 409]);
      const conflict = responses.find((res) => res.statusCode === 409);
      expect(conflict?.json()).toEqual({
        statusCode: 409,
        code: 'email_already_registered',
        message: 'Email already registered',
      });
      expect(await countUsers('race@example.com')).toBe(1);
    });

    it('answers 409 to a sequential duplicate', async () => {
      expect((await register('twice@example.com')).statusCode).toBe(201);

      const second = await register('twice@example.com');

      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ code: 'email_already_registered' });
    });
  });

  describe('GET /bank-connections/catalogue', () => {
    it('needs a login', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/bank-connections/catalogue?country=PL',
      });

      expect(res.statusCode).toBe(401);
    });

    it('serves the second call from the cache (the provider is called once)', async () => {
      const providerCall = vi.spyOn(InMemoryBankConnector.prototype, 'listSupportedBanks');
      const registered = await register('catalogue@example.com');
      const accessToken = String(registered.json<{ accessToken: string }>().accessToken);
      const headers = { authorization: `Bearer ${accessToken}` };

      const first = await app.inject({
        method: 'GET',
        url: '/bank-connections/catalogue?country=PL',
        headers,
      });
      const second = await app.inject({
        method: 'GET',
        url: '/bank-connections/catalogue?country=PL',
        headers,
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual(first.json());
      expect(first.json<unknown[]>().length).toBeGreaterThan(0);
      expect(providerCall).toHaveBeenCalledTimes(1);
      expect(providerCall).toHaveBeenCalledWith('PL');
    });
  });
});
