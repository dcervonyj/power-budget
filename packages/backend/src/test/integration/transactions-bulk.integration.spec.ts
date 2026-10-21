import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { uuidv7 } from 'uuidv7';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';
import { createTestApp, TEST_JWT_SECRET } from './app.js';

interface ListItem {
  id: string;
  ignored: boolean;
  mappingSource: string;
  transfer: { transferId: string; counterpartTransactionId: string | null } | null;
}

interface Member {
  readonly userId: string;
  readonly householdId: string;
  readonly headers: { authorization: string };
}

/**
 * UI-015: `POST /transactions/bulk` with `op: 'transfer'` and `op: 'ignore'` writes (they
 * were 204 no-ops). Owner-checked like `map`: every id must be on the caller's own accounts
 * in the caller's household, and one that is not (partner, other household, unknown)
 * rejects the batch with nothing written.
 */
describe('Integration: bulk transfer and ignore (UI-015)', () => {
  let app: NestFastifyApplication;
  let ann: Member;
  let annAccount: string;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    const householdId = await insertHousehold();
    ann = await insertUser(householdId, 'owner');
    annAccount = await insertAccount(ann);
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  async function insertHousehold(): Promise<string> {
    const householdId = uuidv7();
    await getPool().query(
      `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
      [householdId],
    );

    return householdId;
  }

  async function insertUser(householdId: string, role: string): Promise<Member> {
    const userId = uuidv7();
    await getPool().query(
      `INSERT INTO users (id, email, display_name, default_locale) VALUES ($1, $2, 'u', 'en')`,
      [userId, `${userId}@example.com`],
    );
    await getPool().query(
      `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, $3)`,
      [householdId, userId, role],
    );
    const token = jwt.sign({ sub: userId, householdId }, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m',
    });

    return { userId, householdId, headers: { authorization: `Bearer ${token}` } };
  }

  /** A manual (cash) account through the API, as the web app creates it. */
  async function insertAccount(member: Member): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: member.headers,
      payload: { name: 'Cash', currency: 'PLN' },
    });
    expect(res.statusCode).toBe(201);

    return res.json<{ id: string }>().id;
  }

  async function addTx(member: Member, accountId: string, description: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: member.headers,
      payload: {
        accountId,
        occurredOn: '2026-10-10',
        amountMinor: '-1500',
        currency: 'PLN',
        description,
      },
    });
    expect(res.statusCode).toBe(201);

    return res.json<{ id: string }>().id;
  }

  function bulk(
    member: Member,
    op: 'transfer' | 'ignore',
    ids: string[],
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/transactions/bulk',
      headers: member.headers,
      payload: { ids, op },
    });
  }

  async function listed(member: Member): Promise<Map<string, ListItem>> {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions?limit=100',
      headers: member.headers,
    });
    expect(res.statusCode).toBe(200);

    return new Map(res.json<{ items: ListItem[] }>().items.map((item) => [item.id, item]));
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const { rows } = await getPool().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${sql}`,
      params,
    );

    return rows[0]!.n;
  }

  async function mapToNewItem(member: Member, txId: string): Promise<void> {
    const planId = uuidv7();
    const itemId = uuidv7();
    await getPool().query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
       VALUES ($1, $2, $3, 'P', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
      [planId, member.householdId, member.userId],
    );
    await getPool().query(
      `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
       VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
      [itemId, planId, member.householdId, uuidv7()],
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${txId}/mapping`,
      headers: member.headers,
      payload: { plannedItemId: itemId },
    });
    expect(res.statusCode).toBe(204);
  }

  describe("op 'transfer'", () => {
    it('marks every id as a standalone transfer; the list shows it', async () => {
      const a = await addTx(ann, annAccount, 'to savings');
      const b = await addTx(ann, annAccount, 'to wallet');
      const other = await addTx(ann, annAccount, 'coffee');

      const res = await bulk(ann, 'transfer', [a, b, a]);

      expect(res.statusCode).toBe(204);
      const rows = await listed(ann);
      expect(rows.get(a)?.transfer).toEqual({
        transferId: expect.any(String),
        counterpartTransactionId: null,
      });
      expect(rows.get(b)?.transfer?.counterpartTransactionId).toBeNull();
      expect(rows.get(other)?.transfer).toBeNull();
      expect(await count('transfers')).toBe(2);
    });

    it('keeps ids that already are a transfer (either side) and is idempotent', async () => {
      const a = await addTx(ann, annAccount, 'out');
      const b = await addTx(ann, annAccount, 'in');
      const c = await addTx(ann, annAccount, 'fresh');
      const paired = await app.inject({
        method: 'POST',
        url: `/transactions/${a}/transfer`,
        headers: ann.headers,
        payload: { counterpartTransactionId: b },
      });
      expect(paired.statusCode).toBe(204);

      expect((await bulk(ann, 'transfer', [a, b, c])).statusCode).toBe(204);
      expect((await bulk(ann, 'transfer', [a, b, c])).statusCode).toBe(204);

      expect(await count('transfers')).toBe(2);
      expect(await count('transfers WHERE tx_a_id = $1 AND tx_b_id = $2', [a, b])).toBe(1);
      expect(await count('transfers WHERE tx_a_id = $1 AND tx_b_id IS NULL', [c])).toBe(1);
    });

    it('rejects the whole batch with 409 when one transaction is mapped', async () => {
      const a = await addTx(ann, annAccount, 'to savings');
      const mapped = await addTx(ann, annAccount, 'groceries');
      await mapToNewItem(ann, mapped);

      const res = await bulk(ann, 'transfer', [a, mapped]);

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'already_mapped' });
      expect(await count('transfers')).toBe(0);
    });
  });

  describe("op 'ignore'", () => {
    it('sets ignored on every id and leaves the others alone', async () => {
      const a = await addTx(ann, annAccount, 'refund');
      const b = await addTx(ann, annAccount, 'duplicate');
      const kept = await addTx(ann, annAccount, 'coffee');

      const res = await bulk(ann, 'ignore', [a, b]);

      expect(res.statusCode).toBe(204);
      const rows = await listed(ann);
      expect([rows.get(a)?.ignored, rows.get(b)?.ignored, rows.get(kept)?.ignored]).toEqual([
        true,
        true,
        false,
      ]);
      // Ignored rows leave the unmapped queue.
      const unmapped = await app.inject({
        method: 'GET',
        url: '/transactions?unmappedOnly=true',
        headers: ann.headers,
      });
      expect(unmapped.json<{ items: ListItem[] }>().items.map((item) => item.id)).toEqual([kept]);
    });
  });

  describe.each(['transfer', 'ignore'] as const)("op '%s' is all or nothing on ownership", (op) => {
    it("a partner's transaction (same household) answers 404 and writes nothing", async () => {
      const bob = await insertUser(ann.householdId, 'member');
      const bobTx = await addTx(bob, await insertAccount(bob), 'bob private');
      const own = await addTx(ann, annAccount, 'ann');

      const res = await bulk(ann, op, [own, bobTx]);

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'transaction_not_found' });
      expect(await count('transfers')).toBe(0);
      expect(await count('transactions WHERE ignored')).toBe(0);
    });

    it("another household's or an unknown id answers 404 and writes nothing", async () => {
      const stranger = await insertUser(await insertHousehold(), 'owner');
      const foreignTx = await addTx(stranger, await insertAccount(stranger), 'foreign');
      const own = await addTx(ann, annAccount, 'ann');

      const foreign = await bulk(ann, op, [own, foreignTx]);
      const unknown = await bulk(ann, op, [own, uuidv7()]);

      expect(foreign.statusCode).toBe(404);
      expect(unknown.statusCode).toBe(404);
      expect(await count('transfers')).toBe(0);
      expect(await count('transactions WHERE ignored')).toBe(0);
    });
  });

  it('rejects an unknown op and an empty batch with 400', async () => {
    const own = await addTx(ann, annAccount, 'ann');

    const badOp = await app.inject({
      method: 'POST',
      url: '/transactions/bulk',
      headers: ann.headers,
      payload: { ids: [own], op: 'delete' },
    });
    const empty = await bulk(ann, 'ignore', []);

    expect(badOp.statusCode).toBe(400);
    expect(empty.statusCode).toBe(400);
  });
});
