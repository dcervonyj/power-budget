import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { makeBankSyncJob } from '../doubles/bankSyncJob.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mock } from 'vitest-mock-extended';
import { uuidv7 } from 'uuidv7';
import { BankConnectionId } from '@power-budget/core';
import type { HouseholdId } from '@power-budget/core';
import { startContainers, stopContainers, resetState, getDb, getPool } from './setup.js';
import { createTestApp } from './app.js';
import type {
  BankAccountRepository,
  BankConnector,
  BankConnectorRegistry,
  SyncRunRepository,
} from '../../domain/bank/ports.js';
import type { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import {
  BankSyncProcessor,
  type BankSyncJobPayload,
} from '../../infrastructure/bank/BankSyncProcessor.js';

interface AuthResponse {
  userId: string;
  accessToken: string;
}

interface Owner {
  readonly userId: string;
  readonly householdId: HouseholdId;
  readonly auth: { authorization: string };
}

interface ConnectionRow {
  status: string;
  encrypted_consent: string | null;
  external_consent_ref: string | null;
  disconnected_at: Date | null;
}

const PASSWORD = 'Str0ngPass!';
const BANK = { provider: 'gocardless', bankId: 'PKO_PLPKOPPLPW' } as const;
const REDIRECT_URI = 'https://app.power-budget.test/connect/callback';

/**
 * CLN-038 (audit BE-BUGS-08, BE-BUGS-09): a disconnected bank stays disconnected, and a
 * consent the user abandoned leaves a `pending` connection that does not block a new attempt.
 * Real AppModule against Postgres + Redis; GoCardless is the in-memory connector here.
 */
describe('bank connection lifecycle (CLN-038, real app)', () => {
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

  async function registerOwner(email: string): Promise<Owner> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    const { userId, accessToken } = res.json<AuthResponse>();
    const membership = await getPool().query<{ household_id: HouseholdId }>(
      'SELECT household_id FROM household_users WHERE user_id = $1',
      [userId],
    );
    const householdId = membership.rows[0]?.household_id;
    if (householdId === undefined) {
      throw new Error('registration created no household');
    }
    // Connecting a bank needs an enrolled second factor; the secret itself is not used here.
    await getPool().query(
      `INSERT INTO totp_secrets (user_id, encrypted_secret, verified_at) VALUES ($1, 'unused', now())`,
      [userId],
    );

    return { userId, householdId, auth: { authorization: `Bearer ${accessToken}` } };
  }

  async function initiate(owner: Owner): Promise<{ statusCode: number; connectionId: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/bank-connections',
      headers: owner.auth,
      payload: { ...BANK, redirectUri: REDIRECT_URI },
    });
    const connectionId =
      res.statusCode === 201 ? res.json<{ connectionId: string }>().connectionId : '';

    return { statusCode: res.statusCode, connectionId };
  }

  async function complete(owner: Owner, connectionId: string): Promise<number> {
    const res = await app.inject({
      method: 'GET',
      url: `/bank-connections/${connectionId}/complete?code=auth-code&state=state`,
      headers: owner.auth,
    });

    return res.statusCode;
  }

  async function connectionRow(connectionId: string): Promise<ConnectionRow> {
    const { rows } = await getPool().query<ConnectionRow>(
      `SELECT status, encrypted_consent, external_consent_ref, disconnected_at
       FROM bank_connections WHERE id = $1`,
      [connectionId],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error(`connection ${connectionId} not found`);
    }

    return row;
  }

  it('a new connection is pending until the consent completes', async () => {
    const owner = await registerOwner('pending@example.com');

    const started = await initiate(owner);
    expect(started.statusCode).toBe(201);
    expect(await connectionRow(started.connectionId)).toMatchObject({
      status: 'pending',
      encrypted_consent: null,
    });

    expect(await complete(owner, started.connectionId)).toBe(200);
    const row = await connectionRow(started.connectionId);
    expect(row.status).toBe('active');
    expect(row.encrypted_consent).not.toBeNull();
  });

  it('an abandoned consent does not block a new attempt, an active connection does', async () => {
    const owner = await registerOwner('abandoned@example.com');

    const abandoned = await initiate(owner);
    expect(abandoned.statusCode).toBe(201);

    const retry = await initiate(owner);
    expect(retry.statusCode).toBe(201);
    expect(retry.connectionId).not.toBe(abandoned.connectionId);
    expect(await complete(owner, retry.connectionId)).toBe(200);

    expect((await initiate(owner)).statusCode).toBe(403);
    // The abandoned attempt can no longer become a second active connection to the bank.
    expect(await complete(owner, abandoned.connectionId)).toBe(409);
    expect((await connectionRow(abandoned.connectionId)).status).toBe('pending');
  });

  it('lists only connections that went through consent', async () => {
    const owner = await registerOwner('list@example.com');
    await initiate(owner);
    const second = await initiate(owner);
    await complete(owner, second.connectionId);

    const res = await app.inject({ method: 'GET', url: '/bank-connections', headers: owner.auth });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject([{ id: second.connectionId, status: 'active' }]);
    expect(res.json()).toHaveLength(1);
  });

  it('refresh after disconnect answers 409 and the stored consent is gone', async () => {
    const owner = await registerOwner('disconnect@example.com');
    const { connectionId } = await initiate(owner);
    expect(await complete(owner, connectionId)).toBe(200);

    const refreshed = await app.inject({
      method: 'POST',
      url: `/bank-connections/${connectionId}/refresh`,
      headers: owner.auth,
    });
    expect(refreshed.statusCode).toBe(202);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/bank-connections/${connectionId}`,
      headers: owner.auth,
    });
    expect(removed.statusCode).toBe(204);
    const row = await connectionRow(connectionId);
    expect(row).toMatchObject({ status: 'disconnected', encrypted_consent: null });
    expect(row.disconnected_at).not.toBeNull();

    const res = await app.inject({
      method: 'POST',
      url: `/bank-connections/${connectionId}/refresh`,
      headers: owner.auth,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'bank_connection_invalid_state' });
  });

  it('refresh of a connection still waiting for consent answers 409', async () => {
    const owner = await registerOwner('refresh-pending@example.com');
    const { connectionId } = await initiate(owner);

    const res = await app.inject({
      method: 'POST',
      url: `/bank-connections/${connectionId}/refresh`,
      headers: owner.auth,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'bank_connection_invalid_state' });
  });

  describe('scheduler and sync processor', () => {
    let owner: Owner;
    let repo: DrizzleBankConnectionRepository;

    beforeEach(async () => {
      owner = await registerOwner('worker@example.com');
      repo = new DrizzleBankConnectionRepository(getDb());
    });

    async function seedConnection(
      status: string,
      encryptedConsent: string | null,
    ): Promise<BankConnectionId> {
      const id = BankConnectionId.of(uuidv7());
      await getPool().query(
        `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, external_consent_ref, encrypted_consent, status)
         VALUES ($1, $2, $3, 'gocardless', $4, $5, $6, $7)`,
        [
          id,
          owner.householdId,
          owner.userId,
          `BANK_${status}`,
          `ref-${id}`,
          encryptedConsent,
          status,
        ],
      );

      return id;
    }

    it('schedules only active connections that hold a consent', async () => {
      const synced = await seedConnection('active', 'enc-token');
      await seedConnection('active', null);
      await seedConnection('pending', null);
      await seedConnection('disconnected', 'enc-token');
      await seedConnection('expired', 'enc-token');

      const targets = await new BankSyncSchedulerUseCase(repo).execute();

      expect(targets).toEqual([{ connectionId: synced, householdId: owner.householdId }]);
    });

    it('the processor skips a connection that is not active, even with a consent left over', async () => {
      const connector = mock<BankConnector>();
      const registry = mock<BankConnectorRegistry>();
      registry.resolve.mockReturnValue(connector);
      const syncRunRepo = mock<SyncRunRepository>();
      const processor = new BankSyncProcessor(
        repo,
        mock<BankAccountRepository>(),
        syncRunRepo,
        registry,
        mock<IngestBankTransactionsUseCase>(),
      );

      for (const status of ['disconnected', 'pending', 'expired']) {
        const connectionId = await seedConnection(status, 'enc-token');
        const payload: BankSyncJobPayload = {
          connectionId,
          householdId: owner.householdId,
          trigger: 'manual',
          attended: true,
        };
        await processor.process(makeBankSyncJob(payload));
      }

      expect(syncRunRepo.start).not.toHaveBeenCalled();
      expect(connector.listAccounts).not.toHaveBeenCalled();
    });
  });
});
