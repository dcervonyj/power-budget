import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';
import { createTestApp, TEST_JWT_SECRET } from './app.js';

interface Page {
  items: { id: string; occurredOn: string }[];
  nextCursor: string | null;
}

const TOTAL = 25;
const PAGE_SIZE = 7;
const DATES = ['2026-10-03', '2026-10-02', '2026-10-01'];

/**
 * CLN-008r (audit H16): the list is paged with a keyset cursor on
 * (occurredOn DESC, id DESC). Many rows share a date, so an `id > cursor`
 * cursor over a date ordering used to skip and repeat rows.
 */
describe('Integration: transaction list keyset pagination (CLN-008r)', () => {
  let app: NestFastifyApplication;
  let headers: { authorization: string };

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    headers = await seedHousehold();
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  async function seedHousehold(): Promise<{ authorization: string }> {
    const q = getPool();
    const userId = randomUUID();
    const householdId = randomUUID();
    const connectionId = randomUUID();
    const accountId = randomUUID();
    await q.query(
      `INSERT INTO users (id, email, display_name, default_locale) VALUES ($1, $2, 'u', 'en')`,
      [userId, `${userId}@example.com`],
    );
    await q.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`, [
      householdId,
    ]);
    await q.query(
      `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [householdId, userId],
    );
    await q.query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status)
       VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK', 'active')`,
      [connectionId, householdId, userId],
    );
    await q.query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
       VALUES ($1, $2, $3, $4, 'ext', 'Main', 'PLN')`,
      [accountId, householdId, userId, connectionId],
    );
    for (let i = 0; i < TOTAL; i++) {
      await q.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source)
         VALUES ($1, $2, $3, $4, -100, 'PLN', $5, 'manual')`,
        [randomUUID(), householdId, accountId, DATES[i % DATES.length], `tx ${i}`],
      );
    }
    const token = jwt.sign({ sub: userId, householdId }, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m',
    });

    return { authorization: `Bearer ${token}` };
  }

  async function fetchPage(cursor?: string): Promise<Page> {
    const url = `/transactions?limit=${PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await app.inject({ method: 'GET', url, headers });
    expect(res.statusCode).toBe(200);

    return res.json<Page>();
  }

  it('returns every row exactly once, in a stable (date desc, id desc) order', async () => {
    const seen: Page['items'] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await fetchPage(cursor);
      seen.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(Math.ceil(TOTAL / PAGE_SIZE));
    expect(seen).toHaveLength(TOTAL);
    expect(new Set(seen.map((t) => t.id)).size).toBe(TOTAL);

    const expected = [...seen].sort(
      (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.id.localeCompare(a.id),
    );
    expect(seen.map((t) => t.id)).toEqual(expected.map((t) => t.id));

    const { rows } = await getPool().query<{ id: string }>('SELECT id FROM transactions');
    expect(new Set(seen.map((t) => t.id))).toEqual(new Set(rows.map((r) => r.id)));
  });

  it('issues an opaque base64url cursor and no cursor on the last page', async () => {
    const first = await fetchPage();

    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.nextCursor).not.toBe(first.items[first.items.length - 1]!.id);

    const last = await fetchPage(
      Buffer.from(`2026-09-30|${randomUUID()}`, 'utf8').toString('base64url'),
    );
    expect(last.nextCursor).toBeNull();
  });

  it.each([
    ['not base64url', 'not a cursor!'],
    ['a bare uuid (the old cursor)', randomUUID()],
    ['wrong shape', Buffer.from('hello', 'utf8').toString('base64url')],
    ['bad date', Buffer.from(`2026-13-45|${randomUUID()}`, 'utf8').toString('base64url')],
    ['bad id', Buffer.from('2026-10-01|nope', 'utf8').toString('base64url')],
  ])('answers 400 for a malformed cursor: %s', async (_name, cursor) => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?cursor=${encodeURIComponent(cursor)}`,
      headers,
    });

    expect(res.statusCode).toBe(400);
  });
});
