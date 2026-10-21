import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { startContainers, stopContainers, resetState, getPool } from './setup.js';
import { createTestApp } from './app.js';

interface AuthResponse {
  userId: string;
  accessToken: string;
}

const PASSWORD = 'Str0ngPass!';
// 2^53 + 1 minor units: survives only if the API never goes through a JS number.
const BEYOND_SAFE = '9007199254740993';

/**
 * CLN-002 (audit C5, C8, H3): the real AppModule on Fastify validates request
 * bodies, maps domain errors with their `code`, and returns money as strings.
 */
describe('HTTP hygiene: validation, error codes, bigint money (real app)', () => {
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

  async function register(email: string): Promise<AuthResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);

    return res.json<AuthResponse>();
  }

  it('rejects an invalid body with 400 and per-field errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'short' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      statusCode: 400,
      code: 'validation_failed',
      message: 'Validation failed',
      errors: [
        { field: 'email', messages: ['email must be an email'] },
        {
          field: 'password',
          messages: ['password must be longer than or equal to 8 characters'],
        },
      ],
    });
  });

  it('rejects properties that are not part of the DTO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'extra@example.com', password: PASSWORD, isAdmin: true },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'isAdmin', messages: ['property isAdmin should not exist'] }],
    });
  });

  it('maps a domain error to its status and keeps the code (wrong password -> 401)', async () => {
    await register('wrong-pw@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'wrong-pw@example.com', password: 'not-the-password' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      statusCode: 401,
      code: 'invalid_credentials',
      message: 'Invalid credentials',
    });
  });

  it('maps a duplicate registration to 409 email_already_registered', async () => {
    await register('twice@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'twice@example.com', password: PASSWORD },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'email_already_registered' });
  });

  it('rejects a path id that is not a UUID with 400', async () => {
    const { accessToken } = await register('uuid@example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/transactions/not-a-uuid',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ statusCode: 400, code: 'bad_request' });
  });

  it('stores and returns money beyond 2^53 as exact string minor units', async () => {
    // Registration creates the user's household and puts it in the token.
    const { accessToken, userId } = await register('money@example.com');
    const auth = { authorization: `Bearer ${accessToken}` };
    const membership = await getPool().query<{ household_id: string }>(
      'SELECT household_id FROM household_users WHERE user_id = $1',
      [userId],
    );
    const householdId = membership.rows[0]?.household_id;
    expect(householdId).toEqual(expect.any(String));

    const connectionId = uuidv7();
    const accountId = uuidv7();
    await getPool().query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
       VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK')`,
      [connectionId, householdId, userId],
    );
    await getPool().query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency, balance_minor)
       VALUES ($1, $2, $3, $4, 'ext-1', 'Main', 'PLN', $5)`,
      [accountId, householdId, userId, connectionId, BEYOND_SAFE],
    );

    const created = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: auth,
      payload: {
        accountId,
        occurredOn: '2024-06-15',
        amountMinor: BEYOND_SAFE,
        currency: 'PLN',
        description: 'Big one',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      accountId,
      amount: { amountMinor: BEYOND_SAFE, currency: 'PLN' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/transactions?limit=5000',
      headers: auth,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      items: [{ amount: { amountMinor: BEYOND_SAFE, currency: 'PLN' } }],
      hasMore: false,
    });

    const accounts = await app.inject({
      method: 'GET',
      url: `/bank-connections/${connectionId}/accounts`,
      headers: auth,
    });
    expect(accounts.statusCode).toBe(200);
    expect(accounts.json()).toMatchObject([{ id: accountId, balanceMinor: BEYOND_SAFE }]);
  });
});
