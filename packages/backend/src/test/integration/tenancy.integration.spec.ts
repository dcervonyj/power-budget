import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type {
  BankAccountId,
  BankConnectionId,
  HouseholdId,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { runInDbScope, type DbScope } from '../../infrastructure/database/DbScope.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { DrizzleMappingRepository } from '../../infrastructure/transactions/DrizzleMappingRepository.js';
import { DrizzleTransferRepository } from '../../infrastructure/transactions/DrizzleTransferRepository.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import { DrizzleAuditEventRepository } from '../../infrastructure/audit/DrizzleAuditEventRepository.js';
import { RedactingAuditLogger } from '../../infrastructure/audit/RedactingAuditLogger.js';
import { DisconnectBankUseCase } from '../../application/bank/use-cases/DisconnectBankUseCase.js';
import {
  PlannedItemNotFoundError,
  TransactionNotFoundError,
} from '../../domain/transactions/errors.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';
import { createTestApp, TEST_JWT_SECRET } from './app.js';

interface Tenant {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly connectionId: BankConnectionId;
  readonly accountId: BankAccountId;
  readonly txId: TransactionId;
  readonly plannedItemId: PlannedItemId;
}

type Db = NodePgDatabase<typeof schema>;

let fixtures: Pool;
let appPool: Pool;
let appDb: Db;
let A: Tenant;
let B: Tenant;

function scopeOf(t: Tenant): DbScope {
  return { kind: 'household', householdId: t.householdId, userId: t.userId };
}

function asTenant<T>(t: Tenant, fn: () => Promise<T>): Promise<T> {
  return runInDbScope(scopeOf(t), fn);
}

async function seedTenant(label: string, description: string): Promise<Tenant> {
  const t: Tenant = {
    householdId: randomUUID() as HouseholdId,
    userId: randomUUID() as UserId,
    connectionId: randomUUID() as BankConnectionId,
    accountId: randomUUID() as BankAccountId,
    txId: randomUUID() as TransactionId,
    plannedItemId: randomUUID() as PlannedItemId,
  };
  const planId = randomUUID();
  const q = fixtures;
  await q.query(
    `INSERT INTO users (id, email, display_name, default_locale) VALUES ($1, $2, $3, 'en')`,
    [t.userId, `${label}-${t.userId}@example.com`, label],
  );
  await q.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, $2, 'PLN')`, [
    t.householdId,
    label,
  ]);
  await q.query(
    `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [t.householdId, t.userId],
  );
  await q.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status)
     VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK', 'active')`,
    [t.connectionId, t.householdId, t.userId],
  );
  await q.query(
    `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
     VALUES ($1, $2, $3, $4, $5, 'Main', 'PLN')`,
    [t.accountId, t.householdId, t.userId, t.connectionId, `ext-${label}`],
  );
  await q.query(
    `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source)
     VALUES ($1, $2, $3, '2026-10-01', -1234, 'PLN', $4, 'manual')`,
    [t.txId, t.householdId, t.accountId, description],
  );
  await q.query(
    `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
     VALUES ($1, $2, $3, 'Plan', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
    [planId, t.householdId, t.userId],
  );
  await q.query(
    `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
     VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
    [t.plannedItemId, planId, t.householdId, randomUUID()],
  );

  return t;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await fixtures.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${sql}`,
    params,
  );

  return rows[0]!.n;
}

describe('Integration: tenancy (RLS + scoped repositories) as the least-privilege app role (CLN-005)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    // max: 1 forces every statement onto the same connection, so a leaked setting would show.
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    appDb = drizzle(appPool, { schema });
  });

  beforeEach(async () => {
    await resetState();
    A = await seedTenant('alice', 'coffee 50% off');
    B = await seedTenant('bob', 'coffee 500 beans');
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  describe('database-level RLS', () => {
    it('connects as a role that is neither superuser, owner nor BYPASSRLS', async () => {
      const { rows } = await appPool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
      );

      expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    });

    it('hides every tenant row from a raw query without the settings', async () => {
      const raw = new Pool({ connectionString: (await startContainers()).appDatabaseUrl });
      try {
        for (const table of [
          'transactions',
          'bank_connections',
          'bank_accounts',
          'plans',
          'planned_items',
        ]) {
          const { rows } = await raw.query(`SELECT * FROM ${table}`);
          expect(rows, table).toHaveLength(0);
        }
        await expect(
          raw.query(
            `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency)
             VALUES ($1, $2, $3, '2026-10-02', 1, 'PLN')`,
            [randomUUID(), A.householdId, A.accountId],
          ),
        ).rejects.toMatchObject({ code: '42501' });
      } finally {
        await raw.end();
      }
    });

    it('shows only the scoped household and never leaks the setting to the next statement', async () => {
      const seen = await asTenant(A, () =>
        appPool.query<{ id: string }>('SELECT id FROM transactions'),
      );
      expect(seen.rows.map((r) => r.id)).toEqual([A.txId]);

      // Same (single) pooled connection, no scope: the transaction-local setting is gone.
      const after = await appPool.query('SELECT id FROM transactions');
      expect(after.rows).toHaveLength(0);
    });

    it('applies the settings inside drizzle transactions too', async () => {
      const ids = await asTenant(A, () =>
        appDb.transaction((tx) =>
          tx.select({ id: schema.transactions.id }).from(schema.transactions),
        ),
      );

      expect(ids.map((r) => r.id)).toEqual([A.txId]);
    });

    it('rejects writing a row into another household even with a forged household_id', async () => {
      await expect(
        asTenant(A, () =>
          appPool.query(
            `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency)
             VALUES ($1, $2, $3, '2026-10-02', 1, 'PLN')`,
            [randomUUID(), B.householdId, B.accountId],
          ),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('rejects a mapping from an own transaction to a foreign planned item (transaction_mappings policy)', async () => {
      await expect(
        asTenant(A, () =>
          appPool.query(
            `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
             VALUES ($1, $2, -1234, 'PLN', $3)`,
            [A.txId, B.plannedItemId, A.userId],
          ),
        ),
      ).rejects.toMatchObject({ code: '42501' });
      expect(await count('transaction_mappings')).toBe(0);
    });

    it('lets system scope (worker) see every household', async () => {
      const all = await runInDbScope({ kind: 'system', reason: 'test' }, () =>
        appPool.query('SELECT id FROM transactions'),
      );
      expect(all.rows).toHaveLength(2);
    });

    it('keeps audit_log append-only for the app role', async () => {
      await asTenant(A, () =>
        new DrizzleAuditEventRepository(appDb).log({
          householdId: A.householdId,
          actorId: A.userId,
          subjectType: 'test',
          subjectId: A.txId,
          action: 'test.logged',
          meta: {},
        }),
      );
      expect(await count('audit_log')).toBe(1);

      await expect(asTenant(A, () => appPool.query('DELETE FROM audit_log'))).rejects.toMatchObject(
        {
          code: '42501',
        },
      );
      await expect(
        asTenant(A, () => appPool.query("UPDATE audit_log SET action = 'tampered'")),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asTenant(A, () =>
          new DrizzleAuditEventRepository(appDb).log({
            householdId: B.householdId,
            actorId: A.userId,
            subjectType: 'test',
            subjectId: B.txId,
            action: 'test.forged',
            meta: {},
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
      expect(await count('audit_log')).toBe(1);
    });
  });

  describe('repositories: user A cannot read or write household B, even with forged ids', () => {
    it('findById returns null for a foreign transaction, even with a forged scope', async () => {
      const repo = new DrizzleTransactionRepository(appDb);

      const foreign = await asTenant(A, () =>
        repo.findById(B.txId, { householdId: A.householdId }),
      );
      // Forged scope: the request scope (RLS) still says household A.
      const forged = await asTenant(A, () => repo.findById(B.txId, { householdId: B.householdId }));

      expect(foreign).toBeNull();
      expect(forged).toBeNull();
    });

    it('patch with a forged id or scope changes nothing in household B', async () => {
      const repo = new DrizzleTransactionRepository(appDb);

      await asTenant(A, () =>
        repo.patch(B.txId, { notes: 'pwned' }, { householdId: A.householdId }),
      );
      await asTenant(A, () =>
        repo.patch(B.txId, { notes: 'pwned' }, { householdId: B.householdId }),
      );

      expect(await count(`transactions WHERE notes = 'pwned'`)).toBe(0);
    });

    it('findOwnedAccount rejects a foreign account (manual transaction check)', async () => {
      const repo = new DrizzleTransactionRepository(appDb);
      const scope = { householdId: A.householdId };

      expect(await asTenant(A, () => repo.findOwnedAccount(A.accountId, A.userId, scope))).toEqual({
        id: A.accountId,
        currency: 'PLN',
      });
      expect(
        await asTenant(A, () => repo.findOwnedAccount(B.accountId, A.userId, scope)),
      ).toBeNull();
      expect(
        await asTenant(A, () =>
          repo.findOwnedAccount(B.accountId, B.userId, { householdId: B.householdId }),
        ),
      ).toBeNull();
    });

    it('search treats % and _ literally (escaped ilike)', async () => {
      const repo = new DrizzleTransactionRepository(appDb);
      const scope = { householdId: A.householdId };

      const percent = await asTenant(A, () =>
        repo.list({ householdId: A.householdId, ownerUserId: A.userId, search: '50%' }, scope),
      );
      const underscore = await asTenant(A, () =>
        repo.list({ householdId: A.householdId, ownerUserId: A.userId, search: '_' }, scope),
      );

      expect(percent.items.map((t) => t.transaction.id)).toEqual([A.txId]);
      expect(underscore.items).toHaveLength(0);
    });

    it('mapping to a foreign planned item is rejected and nothing is written', async () => {
      const repo = new DrizzleMappingRepository(appDb);

      await expect(
        asTenant(A, () =>
          repo.set(A.txId, B.plannedItemId, A.userId, { householdId: A.householdId }),
        ),
      ).rejects.toThrow(PlannedItemNotFoundError);
      await expect(
        asTenant(A, () =>
          repo.set(B.txId, A.plannedItemId, A.userId, { householdId: A.householdId }),
        ),
      ).rejects.toThrow(TransactionNotFoundError);

      expect(await count('transaction_mappings')).toBe(0);
    });

    it('bulk map with one foreign transaction is rejected as a whole (audit H10)', async () => {
      const repo = new DrizzleMappingRepository(appDb);

      await expect(
        asTenant(A, () =>
          repo.bulkSet(
            [
              { transactionId: A.txId, plannedItemId: A.plannedItemId },
              { transactionId: B.txId, plannedItemId: A.plannedItemId },
            ],
            A.userId,
            { householdId: A.householdId },
          ),
        ),
      ).rejects.toThrow(TransactionNotFoundError);
      expect(await count('transaction_mappings')).toBe(0);

      await asTenant(A, () =>
        repo.bulkSet([{ transactionId: A.txId, plannedItemId: A.plannedItemId }], A.userId, {
          householdId: A.householdId,
        }),
      );
      expect(await count('transaction_mappings')).toBe(1);
      const mine = await asTenant(A, () =>
        repo.findByTransaction(A.txId, { householdId: A.householdId }),
      );
      expect(mine?.plannedItemId).toBe(A.plannedItemId);
    });

    it('a transfer with a foreign counterpart is rejected (audit H10)', async () => {
      const repo = new DrizzleTransferRepository(appDb);

      await expect(
        asTenant(A, () => repo.mark(A.txId, B.txId, A.userId, { householdId: A.householdId })),
      ).rejects.toThrow(TransactionNotFoundError);
      expect(await count('transfers')).toBe(0);
    });

    it('bank connection writes by a forged id leave household B untouched (audit L4)', async () => {
      const repo = new DrizzleBankConnectionRepository(appDb);
      const at = new Date();

      await asTenant(A, () =>
        repo.markDisconnected(B.connectionId, at, { householdId: A.householdId }),
      );
      await asTenant(A, () =>
        repo.markDisconnected(B.connectionId, at, { householdId: B.householdId }),
      );

      expect(
        await count(`bank_connections WHERE id = $1 AND status = 'active'`, [B.connectionId]),
      ).toBe(1);
    });
  });

  describe('HTTP through the real app (app role, DbScopeInterceptor)', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app?.close();
    });

    function tokenFor(t: Tenant): string {
      return jwt.sign({ sub: t.userId, householdId: t.householdId }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '5m',
      });
    }

    it('lists and reads only own transactions', async () => {
      const headers = { authorization: `Bearer ${tokenFor(A)}` };

      const list = await app.inject({ method: 'GET', url: '/transactions', headers });
      const own = await app.inject({ method: 'GET', url: `/transactions/${A.txId}`, headers });

      expect(list.statusCode).toBe(200);
      expect(list.json<{ items: { id: string }[] }>().items.map((t) => t.id)).toEqual([A.txId]);
      expect(own.statusCode).toBe(200);
    });

    it('patches an own transaction and 404s a foreign id without touching it', async () => {
      const headers = { authorization: `Bearer ${tokenFor(A)}` };

      const own = await app.inject({
        method: 'PATCH',
        url: `/transactions/${A.txId}`,
        headers,
        payload: { notes: 'mine' },
      });
      const foreign = await app.inject({
        method: 'PATCH',
        url: `/transactions/${B.txId}`,
        headers,
        payload: { notes: 'pwned' },
      });
      const foreignGet = await app.inject({
        method: 'GET',
        url: `/transactions/${B.txId}`,
        headers,
      });

      expect(own.statusCode).toBe(200);
      expect(foreign.statusCode).toBe(404);
      expect(foreignGet.statusCode).toBe(404);
      expect(await count(`transactions WHERE id = $1 AND notes = 'mine'`, [A.txId])).toBe(1);
      expect(await count(`transactions WHERE notes = 'pwned'`)).toBe(0);
    });

    it('rejects a manual transaction on a foreign account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/transactions',
        headers: { authorization: `Bearer ${tokenFor(A)}` },
        payload: {
          accountId: B.accountId,
          occurredOn: '2026-10-03',
          amountMinor: '100',
          currency: 'PLN',
          description: 'forged',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json<{ code: string }>().code).toBe('bank_account_not_found');
      expect(await count(`transactions WHERE description = 'forged'`)).toBe(0);
    });

    it('wires the redacting audit logger into the disconnect use case (audit H8)', () => {
      const useCase = app.get(DisconnectBankUseCase);

      expect(useCase['auditLogger']).toBeInstanceOf(RedactingAuditLogger);
    });
  });
});
