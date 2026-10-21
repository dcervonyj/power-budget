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
  refreshToken: string;
}

interface InviteResponse {
  id: string;
  email: string;
  status: 'pending' | 'expired';
  expiresAt: string;
  createdAt: string;
}

const PASSWORD = 'Str0ngPass!';
const ANN = 'ann@example.com';
const BOB = 'bob@example.com';
const TEMPLATE_DIR = join(__dirname, '../../infrastructure/notifications/templates');
const INVITE_LINK = /href="http:\/\/localhost:3000\/invite\/accept\?token=([0-9a-f]{64})"/;

function householdIdOf(accessToken: string): string | null {
  const payload = accessToken.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    householdId: string | null;
  };

  return claims.householdId;
}

function tokenFrom(email: SentEmail): string {
  const match = INVITE_LINK.exec(email.html);
  if (match?.[1] === undefined) {
    throw new Error(`No invite link in the email to ${email.to}`);
  }

  return match[1];
}

/**
 * CLN-006 (audit H7): the whole invite journey over HTTP against the real AppModule,
 * running as the least-privilege app role under RLS. The worker's dispatch processor
 * delivers the outbox rows into a fake email channel.
 */
describe('household invite journey (real app, app role + RLS)', () => {
  let app: NestFastifyApplication;
  let email: InMemoryEmailChannel;
  let dispatcher: DispatchNotificationProcessor;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    email = new InMemoryEmailChannel();
    dispatcher = new DispatchNotificationProcessor(
      new DrizzleNotificationRepository(getDb()),
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  async function register(address: string, locale?: string): Promise<AuthResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: address, password: PASSWORD, ...(locale ? { locale } : {}) },
    });
    expect(res.statusCode).toBe(201);

    return res.json<AuthResponse>();
  }

  function call(
    method: 'GET' | 'POST' | 'DELETE',
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

  async function invite(owner: AuthResponse, address: string): Promise<InviteResponse> {
    const res = await call('POST', '/households/invites', owner.accessToken, { email: address });
    expect(res.statusCode).toBe(201);

    return res.json<InviteResponse>();
  }

  function accept(user: AuthResponse, token: string): Promise<LightMyRequestResponse> {
    return call('POST', '/households/invites/accept', user.accessToken, { token });
  }

  /** What the worker does: dispatch every pending outbox row. Returns the newly sent emails. */
  async function deliverEmails(): Promise<SentEmail[]> {
    const before = email.sent.length;
    const pending = await getPool().query<{ id: string }>(
      'SELECT id FROM notifications_outbox WHERE sent_at IS NULL AND failed_at IS NULL ORDER BY created_at',
    );
    for (const row of pending.rows) {
      await dispatcher.process(
        mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId: row.id } }),
      );
    }

    return email.sent.slice(before);
  }

  async function membersOf(householdId: string): Promise<Array<{ user_id: string; role: string }>> {
    const res = await getPool().query<{ user_id: string; role: string }>(
      'SELECT user_id, role FROM household_users WHERE household_id = $1 ORDER BY role DESC',
      [householdId],
    );

    return res.rows;
  }

  async function insertPlan(householdId: string, ownerUserId: string): Promise<string> {
    const planId = uuidv7();
    await getPool().query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
       VALUES ($1, $2, $3, 'Plan', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
      [planId, householdId, ownerUserId],
    );

    return planId;
  }

  it('owner invites, an unregistered partner gets the email, registers, accepts and shares the household', async () => {
    const ann = await register(ANN);
    const annHousehold = householdIdOf(ann.accessToken);
    expect(annHousehold).not.toBeNull();

    const created = await invite(ann, 'Bob@Example.com');
    expect(created).toMatchObject({ email: BOB, status: 'pending' });
    const ttlMs = Date.parse(created.expiresAt) - Date.parse(created.createdAt);
    expect(ttlMs).toBe(7 * 24 * 60 * 60 * 1000);

    // The email goes to the bare address: Bob has no account yet.
    const [mail, ...others] = await deliverEmails();
    expect(others).toEqual([]);
    expect(mail).toMatchObject({
      to: BOB,
      subject: 'You are invited to a household — Power Budget',
    });
    const token = tokenFrom(mail as SentEmail);
    const outbox = await getPool().query<{
      recipient_user_id: string | null;
      recipient_email: string;
      payload: Record<string, unknown>;
      sent_at: Date | null;
    }>(
      "SELECT recipient_user_id, recipient_email, payload, sent_at FROM notifications_outbox WHERE kind = 'household_invite'",
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({ recipient_user_id: null, recipient_email: BOB });
    expect(outbox.rows[0]?.sent_at).toBeInstanceOf(Date);
    // The raw token is not kept anywhere once the email is sent.
    expect(outbox.rows[0]?.payload).toEqual({
      inviterName: 'ann',
      householdName: "ann's household",
    });
    const stored = await getPool().query<{ token_hash: string }>(
      'SELECT token_hash FROM household_invites',
    );
    expect(stored.rows[0]?.token_hash).not.toBe(token);
    expect(JSON.stringify(outbox.rows)).not.toContain(token);

    // Bob registers (he gets a solo household) and accepts.
    const bob = await register(BOB);
    const bobSoloHousehold = householdIdOf(bob.accessToken);
    expect(bobSoloHousehold).not.toBe(annHousehold);

    const accepted = await accept(bob, token);
    expect(accepted.statusCode).toBe(200);
    const joined = accepted.json<{ householdId: string; accessToken: string }>();
    expect(joined.householdId).toBe(annHousehold);
    expect(householdIdOf(joined.accessToken)).toBe(annHousehold);

    expect(await membersOf(annHousehold as string)).toEqual([
      { user_id: ann.userId, role: 'owner' },
      { user_id: bob.userId, role: 'member' },
    ]);
    // The empty solo household was left and is due for deletion.
    expect(await membersOf(bobSoloHousehold as string)).toEqual([]);
    const solo = await getPool().query<{ delete_scheduled_at: Date | null }>(
      'SELECT delete_scheduled_at FROM households WHERE id = $1',
      [bobSoloHousehold],
    );
    expect(solo.rows[0]?.delete_scheduled_at).toBeInstanceOf(Date);

    // Both read the shared household under RLS; Bob's stale token does not.
    const planId = await insertPlan(annHousehold as string, ann.userId);
    const dashboard = `/households/${annHousehold}/dashboard?planId=${planId}`;
    expect((await call('GET', dashboard, ann.accessToken)).statusCode).toBe(200);
    expect((await call('GET', dashboard, joined.accessToken)).statusCode).toBe(200);
    expect((await call('GET', dashboard, bob.accessToken)).statusCode).toBe(404);

    // Both see who is in the household (UI-013); the stale token sees nothing.
    const members = await call('GET', '/households/members', joined.accessToken);
    expect(members.statusCode).toBe(200);
    expect(
      members
        .json<Array<{ userId: string; email: string; role: string }>>()
        .map(({ userId, email, role }) => ({ userId, email, role })),
    ).toEqual([
      { userId: ann.userId, email: ANN, role: 'owner' },
      { userId: bob.userId, email: BOB, role: 'member' },
    ]);
    expect((await call('GET', '/households/members', bob.accessToken)).statusCode).toBe(404);

    // A refresh also lands Bob in the shared household.
    const refreshed = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: bob.refreshToken },
    });
    expect(refreshed.statusCode).toBe(201);
    expect(householdIdOf(refreshed.json<AuthResponse>().accessToken)).toBe(annHousehold);

    // The token is single-use, the invite is closed and the household is full.
    const reused = await call('POST', '/households/invites/accept', joined.accessToken, { token });
    expect(reused.statusCode).toBe(409);
    expect(reused.json()).toMatchObject({ code: 'invite_already_used' });
    expect((await call('GET', '/households/invites', ann.accessToken)).json()).toEqual([]);
    const third = await call('POST', '/households/invites', ann.accessToken, {
      email: 'carol@example.com',
    });
    expect(third.statusCode).toBe(409);
    expect(third.json()).toMatchObject({ code: 'household_full' });

    // Only the owner invites.
    const byMember = await call('POST', '/households/invites', joined.accessToken, {
      email: 'carol@example.com',
    });
    expect(byMember.statusCode).toBe(403);
    expect(byMember.json()).toMatchObject({ code: 'household_owner_required' });
  });

  it('emails a registered invitee through their account, in their locale, and they can accept', async () => {
    const ann = await register(ANN);
    const bob = await register(BOB, 'pl');

    await invite(ann, BOB);
    const [mail] = await deliverEmails();

    expect(mail?.to).toBe(BOB);
    expect(mail?.html).toContain('Przyjmij zaproszenie');
    const outbox = await getPool().query<{ recipient_user_id: string | null }>(
      "SELECT recipient_user_id FROM notifications_outbox WHERE kind = 'household_invite'",
    );
    expect(outbox.rows[0]?.recipient_user_id).toBe(bob.userId);
    expect((await accept(bob, tokenFrom(mail as SentEmail))).statusCode).toBe(200);
  });

  it('rejects a user signed in with another email and keeps the invite open', async () => {
    const ann = await register(ANN);
    await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const eve = await register('eve@example.com');

    const res = await accept(eve, tokenFrom(mail as SentEmail));

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'email_mismatch' });
    const open = await call('GET', '/households/invites', ann.accessToken);
    expect(open.json<InviteResponse[]>().map((item) => item.email)).toEqual([BOB]);
  });

  it('rejects an expired invite with 410 invite_expired', async () => {
    const ann = await register(ANN);
    await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const bob = await register(BOB);
    await getPool().query("UPDATE household_invites SET expires_at = now() - interval '1 minute'");

    const res = await accept(bob, tokenFrom(mail as SentEmail));

    expect(res.statusCode).toBe(410);
    expect(res.json()).toMatchObject({ code: 'invite_expired' });
    const listed = await call('GET', '/households/invites', ann.accessToken);
    expect(listed.json<InviteResponse[]>().map((item) => item.status)).toEqual(['expired']);
  });

  it('rejects an unknown token with 404 invite_not_found', async () => {
    const bob = await register(BOB);

    const res = await accept(bob, 'f'.repeat(64));

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'invite_not_found' });
  });

  it('a revoked invite link stops working', async () => {
    const ann = await register(ANN);
    const created = await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const bob = await register(BOB);

    const revoked = await call('DELETE', `/households/invites/${created.id}`, ann.accessToken);
    expect(revoked.statusCode).toBe(204);
    const again = await call('DELETE', `/households/invites/${created.id}`, ann.accessToken);
    expect(again.statusCode).toBe(404);

    const res = await accept(bob, tokenFrom(mail as SentEmail));
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'invite_not_found' });
  });

  it('resend rotates the token: the old link dies, the new one works', async () => {
    const ann = await register(ANN);
    const created = await invite(ann, BOB);
    const [first] = await deliverEmails();

    const resent = await call('POST', `/households/invites/${created.id}/resend`, ann.accessToken);
    expect(resent.statusCode).toBe(200);
    const [second] = await deliverEmails();
    const bob = await register(BOB);

    expect(tokenFrom(second as SentEmail)).not.toBe(tokenFrom(first as SentEmail));
    expect((await accept(bob, tokenFrom(first as SentEmail))).statusCode).toBe(404);
    expect((await accept(bob, tokenFrom(second as SentEmail))).statusCode).toBe(200);
  });

  it('a new invite replaces the open one', async () => {
    const ann = await register(ANN);
    await invite(ann, 'wrong@example.com');
    await invite(ann, BOB);

    const listed = await call('GET', '/households/invites', ann.accessToken);

    expect(listed.json<InviteResponse[]>().map((item) => item.email)).toEqual([BOB]);
  });

  it('refuses non-owners: a member and a stranger cannot invite, resend or revoke', async () => {
    const ann = await register(ANN);
    const created = await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const bob = await register(BOB);
    const joined = (await accept(bob, tokenFrom(mail as SentEmail))).json<{
      accessToken: string;
    }>();
    const carol = await register('carol@example.com');
    const second = await call('POST', '/households/invites', carol.accessToken, { email: ANN });
    expect(second.statusCode).toBe(201);

    const memberInvite = await call('POST', '/households/invites', joined.accessToken, {
      email: 'dave@example.com',
    });
    // Carol's invite belongs to Carol's household: from Ann it reads as missing.
    const strangerRevoke = await call(
      'DELETE',
      `/households/invites/${second.json<InviteResponse>().id}`,
      ann.accessToken,
    );
    const memberResend = await call(
      'POST',
      `/households/invites/${created.id}/resend`,
      joined.accessToken,
    );

    expect(memberInvite.statusCode).toBe(403);
    expect(memberResend.statusCode).toBe(403);
    expect(strangerRevoke.statusCode).toBe(404);
    expect(await membersOf(householdIdOf(carol.accessToken) as string)).toEqual([
      { user_id: carol.userId, role: 'owner' },
    ]);
  });

  it('refuses to leave a solo household that has data (409 household_not_empty), nothing changes', async () => {
    const ann = await register(ANN);
    await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const bob = await register(BOB);
    const bobHousehold = householdIdOf(bob.accessToken) as string;
    await insertPlan(bobHousehold, bob.userId);

    const res = await accept(bob, tokenFrom(mail as SentEmail));

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'household_not_empty' });
    expect(await membersOf(bobHousehold)).toEqual([{ user_id: bob.userId, role: 'owner' }]);
    expect(await membersOf(householdIdOf(ann.accessToken) as string)).toHaveLength(1);
    const listed = await call('GET', '/households/invites', ann.accessToken);
    expect(listed.json<InviteResponse[]>()).toHaveLength(1);
  });

  it('two concurrent accepts of one token join once', async () => {
    const ann = await register(ANN);
    await invite(ann, BOB);
    const [mail] = await deliverEmails();
    const bob = await register(BOB);
    const token = tokenFrom(mail as SentEmail);

    const results = await Promise.all([accept(bob, token), accept(bob, token)]);

    expect(results.map((res) => res.statusCode).sort()).toEqual([200, 409]);
    expect(await membersOf(householdIdOf(ann.accessToken) as string)).toHaveLength(2);
  });
});
