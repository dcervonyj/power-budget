import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { AuditLogger } from '../../domain/ports.js';
import type { NewAuditEvent } from '../../domain/entities.js';
import { RedactingAuditLogger } from '../RedactingAuditLogger.js';
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
});
