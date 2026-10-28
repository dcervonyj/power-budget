import 'reflect-metadata';
import { join } from 'node:path';
import { uuidv7 } from 'uuidv7';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { startContainers, stopContainers, resetState, getDb, getPool } from './setup.js';
import { createTestApp } from './app.js';
import { InMemoryEmailChannel, type SentEmail } from '../doubles/InMemoryEmailChannel.js';
import { DrizzleNotificationRepository } from '../../infrastructure/notifications/DrizzleNotificationRepository.js';
import { MjmlTemplateRenderer } from '../../infrastructure/notifications/MjmlTemplateRenderer.js';
import { DispatchNotificationProcessor } from '../../infrastructure/notifications/workers/DispatchNotificationProcessor.js';
import type { DispatchNotificationJobPayload } from '../../infrastructure/notifications/BullMQNotificationDispatchQueue.js';

interface AuthResponse {
  userId: string;
  accessToken: string;
}

interface Member {
  readonly userId: string;
  readonly householdId: string;
  readonly accessToken: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly txId: string;
  readonly description: string;
}

const PASSWORD = 'Str0ngPass!';
const TEMPLATE_DIR = join(__dirname, '../../infrastructure/notifications/templates');
const INVITE_LINK = /href="http:\/\/localhost:3000\/invite\/accept\?token=([0-9a-f]{64})"/;

/**
 * CLN-023: transactions and bank accounts are private to the account owner, also inside a
 * shared household (PRODUCT §4.3, §4.9; the CLN-012 dashboard privacy model). The
 * household is formed through the real CLN-006 invite journey.
 */
describe('Integration: partner privacy of transactions and connection accounts (CLN-023)', () => {
  let app: NestFastifyApplication;
  let email: InMemoryEmailChannel;
  let ann: Member;
  let bob: Member;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    email = new InMemoryEmailChannel();
    const household = await formHousehold();
    ann = await seedMember(household.ann, 'ann coffee at Cafe Nero');
    bob = await seedMember(household.bob, 'bob secret gift for ann');
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  function call(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    accessToken: string,
    payload?: Record<string, unknown>,
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${accessToken}` },
      ...(payload ? { payload } : {}),
    });
  }

  async function register(address: string): Promise<AuthResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: address, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);

    return res.json<AuthResponse>();
  }

  async function deliverInviteToken(): Promise<string> {
    const dispatcher = new DispatchNotificationProcessor(
      new DrizzleNotificationRepository(getDb()),
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    const pending = await getPool().query<{ id: string }>(
      'SELECT id FROM notifications_outbox WHERE sent_at IS NULL AND failed_at IS NULL',
    );
    for (const row of pending.rows) {
      await dispatcher.process(
        mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId: row.id } }),
      );
    }
    const mail = email.sent[email.sent.length - 1] as SentEmail;
    const token = INVITE_LINK.exec(mail.html)?.[1];
    expect(token).toBeDefined();

    return token as string;
  }

  /** Ann registers, invites Bob by email, Bob registers and accepts the emailed link. */
  async function formHousehold(): Promise<{
    ann: { userId: string; householdId: string; accessToken: string };
    bob: { userId: string; householdId: string; accessToken: string };
  }> {
    const annAuth = await register('ann@example.com');
    const invite = await call('POST', '/households/invites', annAuth.accessToken, {
      email: 'bob@example.com',
    });
    expect(invite.statusCode).toBe(201);
    const token = await deliverInviteToken();
    const bobAuth = await register('bob@example.com');
    const accepted = await call('POST', '/households/invites/accept', bobAuth.accessToken, {
      token,
    });
    expect(accepted.statusCode).toBe(200);
    const joined = accepted.json<{ householdId: string; accessToken: string }>();

    return {
      ann: {
        userId: annAuth.userId,
        householdId: joined.householdId,
        accessToken: annAuth.accessToken,
      },
      bob: {
        userId: bobAuth.userId,
        householdId: joined.householdId,
        accessToken: joined.accessToken,
      },
    };
  }

  async function seedMember(
    member: { userId: string; householdId: string; accessToken: string },
    description: string,
  ): Promise<Member> {
    const connectionId = uuidv7();
    const accountId = uuidv7();
    const txId = uuidv7();
    await getPool().query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status)
       VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK', 'active')`,
      [connectionId, member.householdId, member.userId],
    );
    await getPool().query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, iban, currency)
       VALUES ($1, $2, $3, $4, $5, 'Main', 'PL61109010140000071219812874', 'PLN')`,
      [accountId, member.householdId, member.userId, connectionId, `ext-${accountId}`],
    );
    await getPool().query(
      `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source)
       VALUES ($1, $2, $3, '2026-10-01', -4200, 'PLN', $4, 'bank_sync')`,
      [txId, member.householdId, accountId, description],
    );

    return { ...member, connectionId, accountId, txId, description };
  }

  it('both members share one household through the invite flow', () => {
    expect(bob.householdId).toBe(ann.householdId);
    expect(bob.userId).not.toBe(ann.userId);
  });

  it("GET /transactions lists only the caller's own rows, never the partner's", async () => {
    for (const [viewer, partner] of [
      [ann, bob],
      [bob, ann],
    ] as const) {
      const res = await call('GET', '/transactions?limit=50', viewer.accessToken);

      expect(res.statusCode).toBe(200);
      expect(res.json<{ items: { id: string }[] }>().items.map((t) => t.id)).toEqual([viewer.txId]);
      expect(res.body).not.toContain(partner.description);
      expect(res.body).not.toContain(partner.txId);
    }
  });

  it("filters by the partner's account id return nothing", async () => {
    const res = await call('GET', `/transactions?accountId=${bob.accountId}`, ann.accessToken);

    expect(res.statusCode).toBe(200);
    expect(res.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it("GET and PATCH /transactions/:id answer 404 for the partner's transaction", async () => {
    const detail = await call('GET', `/transactions/${bob.txId}`, ann.accessToken);
    expect(detail.statusCode).toBe(404);
    expect(detail.json()).toMatchObject({ code: 'transaction_not_found' });
    expect(detail.body).not.toContain(bob.description);

    const patch = await call('PATCH', `/transactions/${bob.txId}`, ann.accessToken, {
      notes: 'seen it',
    });
    expect(patch.statusCode).toBe(404);
    const { rows } = await getPool().query<{ notes: string | null }>(
      'SELECT notes FROM transactions WHERE id = $1',
      [bob.txId],
    );
    expect(rows[0]?.notes).toBeNull();

    const own = await call('GET', `/transactions/${ann.txId}`, ann.accessToken);
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ transaction: { id: ann.txId } });
  });

  it("GET /bank-connections/:id/accounts answers 404 for the partner's connection", async () => {
    const partner = await call(
      'GET',
      `/bank-connections/${bob.connectionId}/accounts`,
      ann.accessToken,
    );
    expect(partner.statusCode).toBe(404);
    expect(partner.json()).toMatchObject({ code: 'bank_connection_not_found' });
    expect(partner.body).not.toContain(bob.accountId);

    const own = await call(
      'GET',
      `/bank-connections/${ann.connectionId}/accounts`,
      ann.accessToken,
    );
    expect(own.statusCode).toBe(200);
    expect(own.json<{ id: string }[]>().map((a) => a.id)).toEqual([ann.accountId]);
  });

  it("GET /accounts lists only the caller's accounts", async () => {
    const res = await call('GET', '/accounts', bob.accessToken);

    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }[]>().map((a) => a.id)).toEqual([bob.accountId]);
  });

  describe("writes on a partner's transaction answer 404 and change nothing", () => {
    async function insertPlannedItem(): Promise<string> {
      const planId = uuidv7();
      const itemId = uuidv7();
      await getPool().query(
        `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
         VALUES ($1, $2, $3, 'Shared', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
        [planId, ann.householdId, ann.userId],
      );
      const categoryId = uuidv7();
      await getPool().query(
        `INSERT INTO categories (id, household_id, name) VALUES ($1, $2, 'Food')`,
        [categoryId, ann.householdId],
      );
      await getPool().query(
        `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
         VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
        [itemId, planId, ann.householdId, categoryId],
      );

      return itemId;
    }

    async function countRows(sql: string, params: unknown[]): Promise<number> {
      const { rows } = await getPool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${sql}`,
        params,
      );

      return rows[0]!.n;
    }

    it('PATCH /transactions/:id/mapping', async () => {
      const itemId = await insertPlannedItem();

      const res = await call('PATCH', `/transactions/${bob.txId}/mapping`, ann.accessToken, {
        plannedItemId: itemId,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'transaction_not_found' });
      expect(await countRows('transaction_mappings', [])).toBe(0);
      const own = await call('PATCH', `/transactions/${ann.txId}/mapping`, ann.accessToken, {
        plannedItemId: itemId,
      });
      expect(own.statusCode).toBe(204);
    });

    it('POST /transactions/:id/transfer, for the transaction and for the counterpart', async () => {
      const partnerTx = await call(
        'POST',
        `/transactions/${bob.txId}/transfer`,
        ann.accessToken,
        {},
      );
      expect(partnerTx.statusCode).toBe(404);

      const partnerCounterpart = await call(
        'POST',
        `/transactions/${ann.txId}/transfer`,
        ann.accessToken,
        { counterpartTransactionId: bob.txId },
      );
      expect(partnerCounterpart.statusCode).toBe(404);
      expect(partnerCounterpart.json()).toMatchObject({ code: 'transaction_not_found' });
      expect(await countRows('transfers', [])).toBe(0);
    });

    it('DELETE /transactions/:id/transfer', async () => {
      const marked = await call('POST', `/transactions/${bob.txId}/transfer`, bob.accessToken, {});
      expect(marked.statusCode).toBe(204);

      const res = await call('DELETE', `/transactions/${bob.txId}/transfer`, ann.accessToken);

      expect(res.statusCode).toBe(404);
      expect(await countRows('transfers WHERE tx_a_id = $1', [bob.txId])).toBe(1);
    });

    it('PATCH /transactions/:id with ignored (ignore)', async () => {
      const res = await call('PATCH', `/transactions/${bob.txId}`, ann.accessToken, {
        ignored: true,
      });

      expect(res.statusCode).toBe(404);
      expect(await countRows('transactions WHERE id = $1 AND ignored', [bob.txId])).toBe(0);
    });

    it('POST /transactions/bulk rejects the whole batch, writing nothing', async () => {
      const itemId = await insertPlannedItem();

      const res = await call('POST', '/transactions/bulk', ann.accessToken, {
        ids: [ann.txId, bob.txId],
        op: 'map',
        payload: { plannedItemId: itemId },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'transaction_not_found' });
      expect(await countRows('transaction_mappings', [])).toBe(0);

      const own = await call('POST', '/transactions/bulk', ann.accessToken, {
        ids: [ann.txId],
        op: 'map',
        payload: { plannedItemId: itemId },
      });
      expect(own.statusCode).toBe(204);
      expect(await countRows('transaction_mappings WHERE transaction_id = $1', [ann.txId])).toBe(1);
    });
  });
});
