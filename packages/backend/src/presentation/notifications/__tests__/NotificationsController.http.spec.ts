import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { mock } from 'vitest-mock-extended';
import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import { RecordEmailBounceUseCase } from '../../../application/notifications/use-cases/RecordEmailBounceUseCase.js';
import { SvixWebhookVerifier } from '../../../infrastructure/notifications/SvixWebhookVerifier.js';
import { NotificationsController } from '../NotificationsController.js';
import { createHttpTestApp, type HttpTestApp } from '../../../test/http/createHttpTestApp.js';

const SECRET_BYTES = Buffer.from('bounce-webhook-test-secret-32-bytes!');
const WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;
const PAYLOAD = JSON.stringify({
  type: 'email.bounced',
  created_at: '2026-10-26T10:00:00.000Z',
  data: { email_id: 'em_1', to: ['victim@example.com'], subject: 'Invite' },
});

function sign(id: string, timestamp: string, body: string, key: Buffer = SECRET_BYTES): string {
  const digest = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');

  return `v1,${digest}`;
}

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe('POST /notifications/bounce (HTTP)', () => {
  let app: HttpTestApp;
  let repo: ReturnType<typeof mock<NotificationRepository>>;

  async function start(secret: string | undefined): Promise<void> {
    repo = mock<NotificationRepository>();
    app = await createHttpTestApp({
      controllers: [NotificationsController],
      providers: [
        { provide: RecordEmailBounceUseCase, useValue: new RecordEmailBounceUseCase(repo) },
        { provide: SvixWebhookVerifier, useValue: new SvixWebhookVerifier(secret) },
      ],
    });
  }

  function post(headers: Record<string, string>, body: string = PAYLOAD) {
    return app.inject({
      method: 'POST',
      url: '/notifications/bounce',
      headers: { 'content-type': 'application/json', ...headers },
      payload: body,
    });
  }

  beforeEach(async () => {
    await start(WEBHOOK_SECRET);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an unsigned request and does not suppress the address', async () => {
    const res = await post({});

    expect(res.statusCode).toBe(401);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('rejects a request signed with the wrong secret', async () => {
    const ts = nowSeconds();
    const res = await post({
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': sign('msg_1', ts, PAYLOAD, Buffer.from('attacker-guess')),
    });

    expect(res.statusCode).toBe(401);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('rejects a valid signature replayed with a tampered body', async () => {
    const ts = nowSeconds();
    const tampered = JSON.stringify({
      type: 'email.bounced',
      data: { to: ['someone-else@example.com'] },
    });
    const res = await post(
      { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign('msg_1', ts, PAYLOAD) },
      tampered,
    );

    expect(res.statusCode).toBe(401);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });

  it('rejects a correctly signed but stale (replayed) request', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    const res = await post({
      'svix-id': 'msg_1',
      'svix-timestamp': stale,
      'svix-signature': sign('msg_1', stale, PAYLOAD),
    });

    expect(res.statusCode).toBe(401);
  });

  it('accepts a correctly signed bounce and suppresses the address', async () => {
    const ts = nowSeconds();
    const res = await post({
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': `v1,bm90LXRoaXMtb25l ${sign('msg_1', ts, PAYLOAD)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(repo.setEmailBouncing).toHaveBeenCalledWith('victim@example.com');
  });

  it('rejects everything when RESEND_WEBHOOK_SECRET is not configured (fail closed)', async () => {
    await app.close();
    await start(undefined);
    const ts = nowSeconds();

    const res = await post({
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': sign('msg_1', ts, PAYLOAD),
    });

    expect(res.statusCode).toBe(401);
    expect(repo.setEmailBouncing).not.toHaveBeenCalled();
  });
});
