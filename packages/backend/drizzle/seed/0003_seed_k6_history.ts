import { Pool, type PoolClient } from 'pg';
import { uuidv7 } from 'uuidv7';

// CLN-060: history fixture for the k6 gate (tests/perf/dashboard.k6.js), so the gate runs on
// a user with thousands of transactions and catches the history-dependent costs (PERF-01,
// PERF-03, PERF-10). It talks to a running backend for the user, plan and item (public API,
// real password hash and RLS household) and inserts the transactions straight into
// Postgres with the SYNC-001 v2 columns (a bank-sync row looks like an Enable Banking one).
//
//   K6_BASE_URL=http://localhost:3100 DATABASE_URL=<owner url> pnpm db:seed:k6
//
// Logs only the user email and the counts, never the password. Idempotent: a re-run logs in to
// the existing user and replaces its seeded rows.

const BASE_URL = process.env['K6_BASE_URL'] ?? 'http://localhost:3100';
const EMAIL = process.env['K6_EMAIL'] ?? 'k6-history@e2e.test';
const PASSWORD = process.env['K6_PASSWORD'] ?? 'K6-Str0ng-Pass!';
const TX_COUNT = Number(process.env['K6_TX_COUNT'] ?? '5000');
const MAPPED_PERCENT = 70;
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // The e2e backend trusts X-Forwarded-For; own address so the per-IP auth limit is not shared.
  'X-Forwarded-For': '10.254.0.2',
};

interface Tokens {
  accessToken: string;
}

async function call(
  path: string,
  method: string,
  body: unknown,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${BASE_URL}${path}`, { method, headers, body: JSON.stringify(body) });
}

async function expectJson<T>(res: Response, ok: number, what: string): Promise<T> {
  if (res.status !== ok) {
    throw new Error(`${what}: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as T;
}

async function registerOrLogin(): Promise<string> {
  const registered = await call('/auth/register', 'POST', { email: EMAIL, password: PASSWORD });
  if (registered.status === 201) {
    return (await expectJson<Tokens>(registered, 201, 'register')).accessToken;
  }
  const login = await call('/auth/login', 'POST', { email: EMAIL, password: PASSWORD });

  return (await expectJson<Tokens>(login, 201, 'login')).accessToken;
}

async function ensurePlannedItem(token: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };
  const plans = await expectJson<Array<{ id: string }>>(
    await fetch(`${BASE_URL}/plans`, { headers: auth }),
    200,
    'list plans',
  );
  const existing = plans[0];
  const planId =
    existing !== undefined
      ? existing.id
      : (
          await expectJson<{ id: string }>(
            await call(
              '/plans',
              'POST',
              {
                name: 'k6 history plan',
                type: 'personal',
                periodKind: 'monthly',
                periodStart: `${new Date().toISOString().slice(0, 7)}-01`,
                baseCurrency: 'PLN',
              },
              token,
            ),
            201,
            'create plan',
          )
        ).id;
  const items = await expectJson<{ items?: Array<{ id: string }> } | Array<{ id: string }>>(
    await fetch(`${BASE_URL}/plans/${planId}/items`, { headers: auth }),
    200,
    'list items',
  );
  const list = Array.isArray(items) ? items : (items.items ?? []);
  const item = list[0];
  if (item !== undefined) {
    return item.id;
  }
  const categories = await expectJson<Array<{ id: string; kind: string }>>(
    await fetch(`${BASE_URL}/categories`, { headers: auth }),
    200,
    'categories',
  );
  const expense = categories.find((category) => category.kind === 'expense');
  if (expense === undefined) {
    throw new Error('no expense category: run db:seed first');
  }

  return (
    await expectJson<{ id: string }>(
      await call(
        `/plans/${planId}/items`,
        'POST',
        { categoryId: expense.id, direction: 'expense', amountMinor: '50000', currency: 'PLN' },
        token,
      ),
      201,
      'add item',
    )
  ).id;
}

async function seed(): Promise<void> {
  const token = await registerOrLogin();
  const plannedItemId = await ensurePlannedItem(token);

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  // Cross-household writes of a one-off script: RLS bypass, as the other seeds.
  pool.on('connect', (client) => {
    void client.query("SELECT set_config('app.rls_bypass', 'on', false)");
  });
  try {
    const user = await pool.query<{ id: string; household_id: string }>(
      `SELECT u.id, hu.household_id FROM users u
         JOIN household_users hu ON hu.user_id = u.id WHERE u.email = $1`,
      [EMAIL],
    );
    const row = user.rows[0];
    if (row === undefined) {
      throw new Error(`user ${EMAIL} has no household`);
    }
    const accountId = await ensureAccount(pool, row.id, row.household_id);
    await replaceFixtureRows(pool, accountId, row.household_id, row.id, plannedItemId);
    await pool.query('ANALYZE transactions');
    await pool.query('ANALYZE transaction_mappings');
  } finally {
    await pool.end();
  }

  console.error(`seeded ${TX_COUNT} transactions (${MAPPED_PERCENT}% mapped) for ${EMAIL}`);
}

// The fixture rows carry the external id prefix below; a re-run replaces only those, in one
// transaction, so other rows on the account survive and a failed run leaves the old set intact.
const FIXTURE_PREFIX = 'k6-tx-';

async function replaceFixtureRows(
  pool: Pool,
  accountId: string,
  householdId: string,
  userId: string,
  plannedItemId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM transaction_mappings WHERE transaction_id IN
         (SELECT id FROM transactions WHERE account_id = $1 AND external_id LIKE $2)`,
      [accountId, `${FIXTURE_PREFIX}%`],
    );
    await client.query('DELETE FROM transactions WHERE account_id = $1 AND external_id LIKE $2', [
      accountId,
      `${FIXTURE_PREFIX}%`,
    ]);
    await insertTransactions(client, accountId, householdId);
    await insertMappings(client, accountId, householdId, userId, plannedItemId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ensureAccount(pool: Pool, userId: string, householdId: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM bank_accounts WHERE owner_user_id = $1 AND external_id = 'k6-history-account'",
    [userId],
  );
  const found = existing.rows[0];
  if (found !== undefined) {
    return found.id;
  }
  const connectionId = uuidv7();
  const accountId = uuidv7();
  await pool.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status, created_at)
     VALUES ($1, $2, $3, 'enable_banking', 'K6_BANK', 'active', now())`,
    [connectionId, householdId, userId],
  );
  await pool.query(
    `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency, created_at)
     VALUES ($1, $2, $3, $4, 'k6-history-account', 'k6 history account', 'PLN', now())`,
    [accountId, householdId, userId, connectionId],
  );

  return accountId;
}

// Ids are UUIDv7 (the domain rejects anything else), time-ordered by the transaction date.
// Two years back from today, a few rows per day, mixed status / sign / counterparty so the
// filters and the keyset order have something to chew on.
async function insertTransactions(
  pool: Pool,
  accountId: string,
  householdId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO transactions (
       id, household_id, account_id, external_id, occurred_on, amount_minor, currency, description,
       merchant, source, status, booking_date, value_date, transaction_at, counterparty_name,
       counterparty_iban_hash, remittance, mcc, bank_tx_code, entry_reference, fingerprint, source_kind)
     SELECT encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) placing
              substring(int8send(floor(extract(epoch from (current_date - (g % 730)))*1000)::bigint + g) from 3)
              from 1 for 6), 52, 1), 53, 1), 'hex')::uuid, $2, $1, '${FIXTURE_PREFIX}' || g,
            (current_date - (g % 730))::date,
            CASE WHEN g % 9 = 0 THEN ((g % 40) + 1) * 10000 ELSE -(((g % 50) + 1) * 1000) END,
            'PLN', 'k6 transaction ' || g, 'Merchant ' || (g % 40), 'bank_sync',
            CASE WHEN g % 10 = 0 THEN 'pending' ELSE 'booked' END,
            (current_date - (g % 730))::date, (current_date - (g % 730))::date,
            now() - ((g % 730) || ' days')::interval, 'Counterparty ' || (g % 60),
            md5('iban-' || (g % 60)), 'remittance ' || g, '5411', 'PMNT-CCRD-POSD', 'ref-' || g,
            md5('fp-' || g), 'enable_banking'
       FROM generate_series(1, $3::int) AS g`,
    [accountId, householdId, TX_COUNT],
  );
}

async function insertMappings(
  pool: PoolClient,
  accountId: string,
  householdId: string,
  userId: string,
  plannedItemId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO transaction_mappings (transaction_id, household_id, planned_item_id, amount_minor, currency, mapped_by)
     SELECT id, household_id, $3, abs(amount_minor), currency, $4
       FROM transactions
      WHERE account_id = $1 AND household_id = $2 AND status = 'booked' AND external_id LIKE '${FIXTURE_PREFIX}%'
        AND (('x' || substr(md5(id::text), 1, 4))::bit(16)::int % 100) < $5`,
    [accountId, householdId, plannedItemId, userId, MAPPED_PERCENT],
  );
}

seed().catch((err: unknown) => {
  console.error('k6 history seed failed', err);
  process.exit(1);
});
