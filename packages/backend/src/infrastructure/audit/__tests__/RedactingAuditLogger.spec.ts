import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../domain/audit/ports.js';
import type { NewAuditEvent } from '../../../domain/audit/entities.js';
import { REDACTED, RedactingAuditLogger } from '../RedactingAuditLogger.js';
import type { HouseholdId, UserId } from '@power-budget/core';

const HOUSEHOLD_ID = 'hh-1' as HouseholdId;
const ACTOR_ID = 'user-1' as UserId;

function makeEvent(meta: Record<string, unknown>): NewAuditEvent {
  return {
    householdId: HOUSEHOLD_ID,
    actorId: ACTOR_ID,
    subjectType: 'test',
    subjectId: 'test-1',
    action: 'test.action',
    meta,
  };
}

describe('RedactingAuditLogger', () => {
  it('redacts Polish IBAN in meta', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ iban: 'PL61109010140000071219812874' });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    expect(logged).toBeDefined();
    expect(logged!.meta['iban']).toMatch(/^\*\*\*/);
    expect(logged!.meta['iban']).not.toBe('PL61109010140000071219812874');
  });

  it('redacts GB IBAN in meta', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ account: 'GB29NWBK60161331926819' });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    expect(logged!.meta['account']).toMatch(/^\*\*\*/);
  });

  it('redacts amountMinor above threshold', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ amountMinor: 2_000_000 });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    expect(logged!.meta['amountMinor']).toEqual({ redacted: true });
  });

  it('passes through amountMinor below threshold', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ amountMinor: 500 });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    expect(logged!.meta['amountMinor']).toBe(500);
  });

  it('passes through non-sensitive meta unchanged', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ action: 'login', userId: 'abc123' });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    expect(logged!.meta['action']).toBe('login');
    expect(logged!.meta['userId']).toBe('abc123');
  });

  it('handles nested meta objects', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    const event = makeEvent({ payment: { iban: 'PL61109010140000071219812874', amount: 100 } });
    await logger.log(event);

    const logged = inner.log.mock.calls[0]?.[0];
    const payment = logged!.meta['payment'] as Record<string, unknown>;
    expect(payment['iban']).toMatch(/^\*\*\*/);
    expect(payment['amount']).toBe(100);
  });

  describe('by key, bigint-safe (audit M17)', () => {
    async function logged(meta: Record<string, unknown>): Promise<Record<string, unknown>> {
      const inner = mock<AuditLogger>();
      const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });
      await logger.log(makeEvent(meta));

      return inner.log.mock.calls[0]![0].meta;
    }

    it('keeps large numbers under non-amount keys', async () => {
      const meta = await logged({ count: 5_000_000, occurredAtMs: 1_792_586_372_460 });

      expect(meta).toEqual({ count: 5_000_000, occurredAtMs: 1_792_586_372_460 });
    });

    it('redacts large amounts under every amount key, including negatives and strings', async () => {
      const meta = await logged({
        amount: 2_000_000,
        balanceMinor: 3_000_000n,
        limitMinor: '-4000000',
        refundMinor: -5_000_000,
      });

      expect(meta).toEqual({
        amount: REDACTED,
        balanceMinor: REDACTED,
        limitMinor: REDACTED,
        refundMinor: REDACTED,
      });
    });

    it('redacts a Money object amount and keeps its currency', async () => {
      const meta = await logged({ money: { amountMinor: 9_000_000n, currency: 'PLN' } });

      expect(meta).toEqual({ money: { amountMinor: REDACTED, currency: 'PLN' } });
    });

    it('turns every remaining bigint into a decimal string so jsonb accepts it', async () => {
      const meta = await logged({
        amountMinor: 1_500n,
        nested: [{ seq: 12_345_678_901_234_567_890n }],
      });

      expect(meta).toEqual({ amountMinor: '1500', nested: [{ seq: '12345678901234567890' }] });
      expect(() => JSON.stringify(meta)).not.toThrow();
    });

    it('masks IBANs inside free text but keeps the rest of the text', async () => {
      const meta = await logged({ note: 'paid to PL61109010140000071219812874 today' });

      expect(meta).toEqual({ note: 'paid to ***2874 today' });
    });

    it('masks account keys even when the value is not a valid IBAN', async () => {
      const meta = await logged({ accountNumber: '12345678' });

      expect(meta).toEqual({ accountNumber: '***5678' });
    });

    it('does not mask short uppercase codes that are not IBANs', async () => {
      const meta = await logged({ bankId: 'PKOPPLPW', provider: 'GB12ABCD' });

      expect(meta).toEqual({ bankId: 'PKOPPLPW', provider: 'GB12ABCD' });
    });
  });

  it('serves the plans AuditLogPort through the same redacting path', async () => {
    const inner = mock<AuditLogger>();
    const logger = new RedactingAuditLogger(inner, { thresholdMinor: 1_000_000n });

    await logger.record({
      householdId: HOUSEHOLD_ID,
      actorUserId: ACTOR_ID,
      action: 'PLAN_ARCHIVED',
      subjectType: 'plan',
      subjectId: 'plan-1',
    });

    expect(inner.log).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      actorId: ACTOR_ID,
      action: 'PLAN_ARCHIVED',
      subjectType: 'plan',
      subjectId: 'plan-1',
      meta: {},
    });
  });
});
