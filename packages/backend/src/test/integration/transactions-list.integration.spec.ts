import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { uuidv7 } from 'uuidv7';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';
import { createTestApp, TEST_JWT_SECRET } from './app.js';

interface ListItem {
  id: string;
  status: string;
  ignored: boolean;
  source: string;
  mapping: {
    plannedItemId: string;
    planId: string;
    planName: string;
    planArchived: boolean;
    categoryId: string;
    categoryName: string | null;
    categorySeedKey: string | null;
    mappedAt: string;
  } | null;
  mappingSource: string;
  transfer: { transferId: string; counterpartTransactionId: string | null } | null;
}

interface ListPage {
  items: ListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface AccountItem {
  id: string;
  kind: string;
  name: string;
  currency: string;
  connectionId: string | null;
  balance: { amountMinor: string; currency: string } | null;
}

interface Member {
  readonly userId: string;
  readonly householdId: string;
  readonly headers: { authorization: string };
}

/**
 * CLN-023: `GET /transactions` rows carry mapping, transfer and status from one query;
 * `unmappedOnly` and `status` filter in SQL under the keyset cursor; `GET /accounts`
 * lists only the caller's own accounts; manual transactions go on own accounts only.
 */
describe('Integration: transaction list read model, accounts and manual transactions (CLN-023)', () => {
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

  async function insertHousehold(): Promise<string> {
    const householdId = uuidv7();
    await getPool().query(
      `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
      [householdId],
    );

    return householdId;
  }

  async function insertBankAccount(member: Member, currency = 'PLN'): Promise<string> {
    const connectionId = uuidv7();
    const accountId = uuidv7();
    await getPool().query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status)
       VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK', 'active')`,
      [connectionId, member.householdId, member.userId],
    );
    await getPool().query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency, balance_minor)
       VALUES ($1, $2, $3, $4, $5, 'Main', $6, 9007199254740993)`,
      [accountId, member.householdId, member.userId, connectionId, `ext-${accountId}`, currency],
    );

    return accountId;
  }

  async function insertTx(
    member: Member,
    accountId: string,
    occurredOn: string,
    extra: {
      status?: string;
      ignored?: boolean;
      currency?: string;
      source?: string;
      sourceKind?: string;
    } = {},
  ): Promise<string> {
    const id = uuidv7();
    await getPool().query(
      `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source, status, ignored, source_kind)
       VALUES ($1, $2, $3, $4, -100, $7, 'tx', $8, $5, $6, $9)`,
      [
        id,
        member.householdId,
        accountId,
        occurredOn,
        extra.status ?? 'booked',
        extra.ignored ?? false,
        extra.currency ?? 'PLN',
        extra.source ?? 'bank_sync',
        extra.sourceKind ?? null,
      ],
    );

    return id;
  }

  async function insertPlannedItem(
    member: Member,
    plan: { name: string; archived: boolean; category?: string },
  ): Promise<{ planId: string; plannedItemId: string; categoryId: string }> {
    const planId = uuidv7();
    const plannedItemId = uuidv7();
    const categoryId = uuidv7();
    await getPool().query(
      `INSERT INTO categories (id, household_id, name, kind) VALUES ($1, $2, $3, 'expense')`,
      [categoryId, member.householdId, plan.category ?? 'Groceries'],
    );
    await getPool().query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency, archived_at)
       VALUES ($1, $2, $3, $4, 'household', 'monthly', '2026-09-01', '2026-09-30', 'PLN', $5)`,
      [planId, member.householdId, member.userId, plan.name, plan.archived ? new Date() : null],
    );
    await getPool().query(
      `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
       VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
      [plannedItemId, planId, member.householdId, categoryId],
    );

    return { planId, plannedItemId, categoryId };
  }

  async function map(member: Member, txId: string, plannedItemId: string): Promise<void> {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${txId}/mapping`,
      headers: member.headers,
      payload: { plannedItemId },
    });
    expect(res.statusCode).toBe(204);
  }

  async function markTransfer(member: Member, txId: string, counterpart: string | null) {
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${txId}/transfer`,
      headers: member.headers,
      payload: counterpart === null ? {} : { counterpartTransactionId: counterpart },
    });
    expect(res.statusCode).toBe(204);
  }

  async function list(member: Member, query: string): Promise<ListPage> {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?${query}`,
      headers: member.headers,
    });
    expect(res.statusCode).toBe(200);

    return res.json<ListPage>();
  }

  async function listAll(member: Member, query: string): Promise<ListItem[]> {
    const seen: ListItem[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: ListPage = await list(
        member,
        cursor === null ? query : `${query}&cursor=${cursor}`,
      );
      seen.push(...page.items);
      cursor = page.nextCursor;
      pages++;
    } while (cursor !== null && pages < 20);

    return seen;
  }

  describe('GET /transactions', () => {
    it('returns mapping (archived plan included), transfer, ignored and status per row', async () => {
      const householdId = await insertHousehold();
      const me = await insertUser(householdId, 'owner');
      const account = await insertBankAccount(me);
      const item = await insertPlannedItem(me, { name: 'September', archived: false });

      const mapped = await insertTx(me, account, '2026-09-10');
      const pairOut = await insertTx(me, account, '2026-09-09');
      const pairIn = await insertTx(me, account, '2026-09-09');
      const standalone = await insertTx(me, account, '2026-09-08');
      const ignored = await insertTx(me, account, '2026-09-07', { ignored: true });
      const pending = await insertTx(me, account, '2026-09-06', { status: 'pending' });
      const cancelled = await insertTx(me, account, '2026-09-05', { status: 'cancelled' });

      await map(me, mapped, item.plannedItemId);
      await markTransfer(me, pairOut, pairIn);
      await markTransfer(me, standalone, null);
      // Archiving the plan afterwards must not hide the mapping's names.
      await getPool().query(`UPDATE plans SET archived_at = now() WHERE id = $1`, [item.planId]);

      const page = await list(me, 'limit=50');
      const byId = new Map(page.items.map((row) => [row.id, row]));

      expect(page.items).toHaveLength(7);
      expect(byId.get(mapped)).toMatchObject({
        status: 'booked',
        ignored: false,
        mappingSource: 'manual',
        transfer: null,
        mapping: {
          plannedItemId: item.plannedItemId,
          planId: item.planId,
          planName: 'September',
          planArchived: true,
          categoryId: item.categoryId,
          categoryName: 'Groceries',
          categorySeedKey: null,
        },
      });
      expect(byId.get(mapped)?.mapping?.mappedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const out = byId.get(pairOut)!;
      const back = byId.get(pairIn)!;
      expect(out).toMatchObject({ mapping: null, mappingSource: 'none' });
      expect(out.transfer).toEqual({
        transferId: expect.any(String),
        counterpartTransactionId: pairIn,
      });
      expect(back.transfer).toEqual({
        transferId: out.transfer!.transferId,
        counterpartTransactionId: pairOut,
      });
      expect(byId.get(standalone)?.transfer).toEqual({
        transferId: expect.any(String),
        counterpartTransactionId: null,
      });
      expect(byId.get(ignored)).toMatchObject({ ignored: true, mapping: null, transfer: null });
      expect(byId.get(pending)).toMatchObject({ status: 'pending', mappingSource: 'none' });
      expect(byId.get(cancelled)).toMatchObject({ status: 'cancelled' });
    });

    it('applies unmappedOnly in SQL across keyset pages, and the status filter', async () => {
      const householdId = await insertHousehold();
      const me = await insertUser(householdId, 'owner');
      const account = await insertBankAccount(me);
      const item = await insertPlannedItem(me, { name: 'October', archived: false });
      const dates = ['2026-10-03', '2026-10-02', '2026-10-01'];

      const unmapped: string[] = [];
      for (let i = 0; i < 24; i++) {
        const date = dates[i % dates.length]!;
        const id = await insertTx(me, account, date, {
          status: i % 6 === 5 ? 'pending' : 'booked',
          ignored: i % 6 === 4,
        });
        if (i % 6 === 0) {
          await map(me, id, item.plannedItemId);
        } else if (i % 6 === 1) {
          await markTransfer(me, id, null);
        } else if (i % 6 !== 4) {
          unmapped.push(id);
        }
      }

      const firstPage = await list(me, 'unmappedOnly=true&limit=3');
      expect(firstPage.items).toHaveLength(3);
      expect(firstPage.hasMore).toBe(true);

      const seen = await listAll(me, 'unmappedOnly=true&limit=3');
      expect(seen).toHaveLength(unmapped.length);
      expect(new Set(seen.map((row) => row.id))).toEqual(new Set(unmapped));
      expect(
        seen.every((row) => row.mapping === null && row.transfer === null && !row.ignored),
      ).toBe(true);

      const pendingOnly = await listAll(me, 'status=pending&limit=2');
      expect(pendingOnly).toHaveLength(4);
      expect(pendingOnly.every((row) => row.status === 'pending')).toBe(true);

      const pendingUnmapped = await listAll(me, 'status=pending&unmappedOnly=true&limit=2');
      expect(pendingUnmapped).toHaveLength(4);

      const bad = await app.inject({
        method: 'GET',
        url: '/transactions?status=posted',
        headers: me.headers,
      });
      expect(bad.statusCode).toBe(400);
    });

    it('applies mapped and transfer in SQL across keyset pages', async () => {
      const householdId = await insertHousehold();
      const me = await insertUser(householdId, 'owner');
      const account = await insertBankAccount(me);
      const item = await insertPlannedItem(me, { name: 'October', archived: false });
      const dates = ['2026-10-03', '2026-10-02', '2026-10-01'];

      const mapped: string[] = [];
      const transfers: string[] = [];
      const others: string[] = [];
      for (let i = 0; i < 24; i++) {
        const date = dates[i % dates.length]!;
        const id = await insertTx(me, account, date, { ignored: i % 6 === 4 });
        if (i % 6 === 0) {
          await map(me, id, item.plannedItemId);
          mapped.push(id);
        } else if (i % 6 === 1) {
          await markTransfer(me, id, null);
          transfers.push(id);
        } else {
          others.push(id);
        }
      }

      const seenMapped = await listAll(me, 'mapped=true&limit=3');
      expect(new Set(seenMapped.map((row) => row.id))).toEqual(new Set(mapped));
      expect(seenMapped.every((row) => row.mapping !== null && row.transfer === null)).toBe(true);

      const seenTransfers = await listAll(me, 'transfer=true&limit=3');
      expect(new Set(seenTransfers.map((row) => row.id))).toEqual(new Set(transfers));

      const seenNonTransfers = await listAll(me, 'transfer=false&limit=5');
      expect(new Set(seenNonTransfers.map((row) => row.id))).toEqual(
        new Set([...mapped, ...others]),
      );

      const bad = await app.inject({
        method: 'GET',
        url: '/transactions?transfer=maybe',
        headers: me.headers,
      });
      expect(bad.statusCode).toBe(400);
    });

    it('applies categoryId, currency and source in SQL across keyset pages (CLN-050)', async () => {
      const householdId = await insertHousehold();
      const me = await insertUser(householdId, 'owner');
      const account = await insertBankAccount(me);
      const groceries = await insertPlannedItem(me, { name: 'October', archived: false });
      const rent = await insertPlannedItem(me, {
        name: 'October',
        archived: false,
        category: 'Rent',
      });
      const dates = ['2026-10-03', '2026-10-02', '2026-10-01'];

      const rows: { id: string; category: string | null; currency: string; source: string }[] = [];
      for (let i = 0; i < 24; i++) {
        const currency = i % 2 === 0 ? 'EUR' : 'PLN';
        const source = i % 6 === 5 ? 'manual' : i % 6 === 4 ? 'enable_banking' : 'legacy_bank';
        const id = await insertTx(me, account, dates[i % dates.length]!, {
          currency,
          source: source === 'manual' ? 'manual' : 'bank_sync',
          sourceKind: source === 'legacy_bank' ? undefined : source,
          status: source === 'manual' ? 'manual' : 'booked',
        });
        const item = i % 3 === 0 ? groceries : i % 3 === 1 ? rent : null;
        if (item !== null) {
          await map(me, id, item.plannedItemId);
        }
        rows.push({ id, category: item === null ? null : item.categoryId, currency, source });
      }
      const ids = (keep: (row: (typeof rows)[number]) => boolean): Set<string> =>
        new Set(rows.filter(keep).map((row) => row.id));
      const seen = async (query: string): Promise<Set<string>> =>
        new Set((await listAll(me, `${query}&limit=3`)).map((row) => row.id));

      expect(await seen(`categoryId=${groceries.categoryId}`)).toEqual(
        ids((row) => row.category === groceries.categoryId),
      );
      expect(await seen('currency=EUR')).toEqual(ids((row) => row.currency === 'EUR'));
      expect(await seen('source=manual')).toEqual(ids((row) => row.source === 'manual'));
      // Every bank row, with or without the SYNC-001 provider.
      expect(await seen('source=bank_sync')).toEqual(ids((row) => row.source !== 'manual'));
      expect(await seen('source=enable_banking')).toEqual(
        ids((row) => row.source === 'enable_banking'),
      );
      expect(await seen(`categoryId=${rent.categoryId}&currency=PLN&source=bank_sync`)).toEqual(
        ids(
          (row) =>
            row.category === rent.categoryId && row.currency === 'PLN' && row.source !== 'manual',
        ),
      );
      expect(await seen(`categoryId=${uuidv7()}`)).toEqual(new Set());
      // A category's rows are mapped: `mapped` keeps them all, `unmappedOnly` none.
      expect(await seen(`categoryId=${groceries.categoryId}&mapped=true`)).toEqual(
        ids((row) => row.category === groceries.categoryId),
      );
      expect(await seen(`categoryId=${groceries.categoryId}&unmappedOnly=true`)).toEqual(new Set());

      // An empty cursor is a 400, not the first page.
      for (const bad of ['currency=XYZ', 'source=gocardless', 'categoryId=nope', 'cursor=']) {
        const res = await app.inject({
          method: 'GET',
          url: `/transactions?${bad}`,
          headers: me.headers,
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

  describe('accounts and manual transactions', () => {
    let me: Member;
    let partner: Member;
    let myBank: string;
    let partnerBank: string;
    let otherHouseholdBank: string;

    beforeEach(async () => {
      const householdId = await insertHousehold();
      me = await insertUser(householdId, 'owner');
      partner = await insertUser(householdId, 'member');
      myBank = await insertBankAccount(me);
      partnerBank = await insertBankAccount(partner);
      const stranger = await insertUser(await insertHousehold(), 'owner');
      otherHouseholdBank = await insertBankAccount(stranger);
    });

    async function createCash(member: Member, payload: object) {
      return app.inject({ method: 'POST', url: '/accounts', headers: member.headers, payload });
    }

    async function addManual(member: Member, payload: object) {
      return app.inject({
        method: 'POST',
        url: '/transactions',
        headers: member.headers,
        payload,
      });
    }

    it("GET /accounts lists only the caller's own accounts, bank and manual", async () => {
      const created = await createCash(me, { name: '  Cash ', currency: 'PLN' });
      expect(created.statusCode).toBe(201);
      const cash = created.json<AccountItem>();
      expect(cash).toMatchObject({
        kind: 'manual',
        name: 'Cash',
        currency: 'PLN',
        connectionId: null,
        balance: null,
      });

      const mine = await app.inject({ method: 'GET', url: '/accounts', headers: me.headers });
      expect(mine.statusCode).toBe(200);
      const mineItems = mine.json<AccountItem[]>();
      expect(mineItems.map((a) => a.id).sort()).toEqual([myBank, cash.id].sort());
      expect(mineItems.find((a) => a.id === myBank)).toMatchObject({
        kind: 'bank',
        connectionId: expect.any(String),
        balance: { amountMinor: '9007199254740993', currency: 'PLN' },
      });

      const theirs = await app.inject({
        method: 'GET',
        url: '/accounts',
        headers: partner.headers,
      });
      expect(theirs.json<AccountItem[]>().map((a) => a.id)).toEqual([partnerBank]);
    });

    it('POST /accounts validates the body', async () => {
      expect((await createCash(me, { name: '   ', currency: 'PLN' })).statusCode).toBe(400);
      expect((await createCash(me, { name: 'Cash', currency: 'XXX' })).statusCode).toBe(400);
      expect((await createCash(me, { name: 'x'.repeat(101), currency: 'PLN' })).statusCode).toBe(
        400,
      );
      expect((await createCash(me, { currency: 'PLN' })).statusCode).toBe(400);
    });

    it('creates a manual transaction on an own cash account; it lists as manual and unmapped', async () => {
      const cash = (await createCash(me, { name: 'Cash', currency: 'PLN' })).json<AccountItem>();

      const res = await addManual(me, {
        accountId: cash.id,
        occurredOn: '2026-10-21',
        amountMinor: '-1250',
        currency: 'PLN',
        description: 'Bakery',
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        accountId: cash.id,
        source: 'manual',
        status: 'manual',
        amount: { amountMinor: '-1250', currency: 'PLN' },
      });
      const page = await list(me, `accountId=${cash.id}&unmappedOnly=true`);
      expect(page.items.map((row) => row.id)).toEqual([res.json<{ id: string }>().id]);
      expect(page.items[0]).toMatchObject({ source: 'manual', mappingSource: 'none' });
    });

    it.each([
      ['a decimal amount', { amountMinor: '12.50' }],
      ['a float JSON amount', { amountMinor: 12.5 }],
      ['a zero amount', { amountMinor: '0' }],
      ['a negative zero amount', { amountMinor: '-000' }],
      ['an amount over 18 digits', { amountMinor: '1234567890123456789' }],
      ['an unknown currency', { currency: 'XXX' }],
      ['a bad date', { occurredOn: '21.10.2026' }],
      ['an empty description', { description: '' }],
      ['an amount not in the account currency', { currency: 'EUR' }],
    ])('answers 400 for %s', async (_name, override) => {
      const res = await addManual(me, {
        accountId: myBank,
        occurredOn: '2026-10-21',
        amountMinor: '-1250',
        currency: 'PLN',
        description: 'Bakery',
        ...override,
      });

      expect(res.statusCode).toBe(400);
    });

    it("answers 404 for the partner's account and another household's account", async () => {
      for (const accountId of [partnerBank, otherHouseholdBank, uuidv7()]) {
        const res = await addManual(me, {
          accountId,
          occurredOn: '2026-10-21',
          amountMinor: '-1250',
          currency: 'PLN',
          description: 'Bakery',
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'bank_account_not_found' });
      }
      const { rows } = await getPool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM transactions WHERE source = 'manual'`,
      );
      expect(rows[0]!.n).toBe(0);
    });
  });
});
