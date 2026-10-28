import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { SvixWebhookVerifier } from './SvixWebhookVerifier.js';
import type { WebhookHeaders } from '../../domain/shared/ports.js';

const KEY = Buffer.from('svix-verifier-unit-test-key');
const SECRET = `whsec_${KEY.toString('base64')}`;
const NOW_MS = 1_760_000_000_000;
const TS = String(NOW_MS / 1000);
const BODY = '{"type":"email.bounced","data":{"to":["a@example.com"]}}';

function sign(id: string, ts: string, body: string): string {
  return `v1,${createHmac('sha256', KEY).update(`${id}.${ts}.${body}`).digest('base64')}`;
}

function headers(
  id: string | undefined,
  timestamp: string | undefined,
  signature: string | undefined,
): WebhookHeaders {
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature };
}

function fixedNow(): number {
  return NOW_MS;
}

describe('SvixWebhookVerifier', () => {
  const verifier = new SvixWebhookVerifier(SECRET, fixedNow);

  it('accepts a valid signature over the raw body', () => {
    expect(verifier.verify(Buffer.from(BODY), headers('msg_1', TS, sign('msg_1', TS, BODY)))).toBe(
      true,
    );
  });

  it('rejects missing headers', () => {
    expect(verifier.verify(BODY, headers(undefined, TS, 'v1,x'))).toBe(false);
    expect(verifier.verify(BODY, headers('msg_1', undefined, 'v1,x'))).toBe(false);
    expect(verifier.verify(BODY, headers('msg_1', TS, undefined))).toBe(false);
  });

  it('rejects a missing raw body', () => {
    expect(verifier.verify(undefined, headers('msg_1', TS, sign('msg_1', TS, BODY)))).toBe(false);
  });

  it('rejects a signature for a different message id', () => {
    expect(verifier.verify(BODY, headers('msg_2', TS, sign('msg_1', TS, BODY)))).toBe(false);
  });

  it('rejects timestamps outside the 5-minute tolerance', () => {
    const old = String(NOW_MS / 1000 - 301);

    expect(verifier.verify(BODY, headers('msg_1', old, sign('msg_1', old, BODY)))).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    const unconfigured = new SvixWebhookVerifier(undefined, fixedNow);

    expect(unconfigured.verify(BODY, headers('msg_1', TS, sign('msg_1', TS, BODY)))).toBe(false);
  });
});
