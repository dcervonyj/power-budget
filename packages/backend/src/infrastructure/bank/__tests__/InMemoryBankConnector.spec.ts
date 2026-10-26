import { describe, it, expect, beforeEach } from 'vitest';
import type { EncryptedString } from '@power-budget/core';
import { IsoDate } from '@power-budget/core';
import type { RawBankAccount, RawTransaction } from '../../../domain/bank/entities.js';
import type { FetchTransactionsInput } from '../../../domain/bank/ports.js';
import { InMemoryBankConnector, type InMemoryBankClock } from '../InMemoryBankConnector.js';
import { InMemoryBankScenarios, type ScriptedPayment } from '../InMemoryBankScenarios.js';

class ManualClock implements InMemoryBankClock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(at: Date): void {
    this.current = at;
  }
}

const DAY_1 = new Date('2026-10-01T09:00:00Z');
const DAY_2 = new Date('2026-10-02T09:00:00Z');
const DAY_3 = new Date('2026-10-03T09:00:00Z');
const CONSENT = 'inmem-token:ref' as EncryptedString;

const ACCOUNT: RawBankAccount = {
  externalId: 'acc-pln',
  name: 'PKO PLN',
  iban: null,
  currency: 'PLN',
  balanceMinor: 0n,
};

const FUEL: ScriptedPayment = {
  accountExternalId: 'acc-pln',
  day1: DAY_1,
  amountMinor: -20000n,
  currency: 'PLN',
  counterpartyName: 'ORLEN',
  remittance: 'ORLEN STACJA 123',
};

const PENDING_FUEL: RawTransaction = {
  accountExternalId: 'acc-pln',
  status: 'pending',
  entryReference: null,
  bookingDate: null,
  valueDate: null,
  transactionDate: IsoDate.of('2026-10-01'),
  amountMinor: -20000n,
  currency: 'PLN',
  direction: 'debit',
  originalAmount: null,
  counterpartyName: 'ORLEN',
  counterpartyIban: null,
  remittance: 'ORLEN STACJA 123',
  mcc: null,
  bankTxCode: null,
  balanceAfter: null,
};

function fetchInput(dateFrom: Date): FetchTransactionsInput {
  return {
    account: { externalId: 'acc-pln' },
    consent: CONSENT,
    dateFrom,
    strategy: 'default',
    psu: null,
  };
}

describe('InMemoryBankConnector', () => {
  let clock: ManualClock;
  let connector: InMemoryBankConnector;

  beforeEach(() => {
    clock = new ManualClock(DAY_1);
    connector = new InMemoryBankConnector('enable_banking', clock);
  });

  it('keeps gocardless as the default provider (the registry fallback without credentials)', () => {
    expect(new InMemoryBankConnector().provider).toBe('gocardless');
    expect(connector.provider).toBe('enable_banking');
  });

  it('reports pending on day 1 and booked with a changed amount on day 3', async () => {
    connector.scriptAccount({
      account: ACCOUNT,
      snapshots: InMemoryBankScenarios.pendingThenBooked(FUEL, {
        amountMinor: -18750n,
        entryReference: 'eb-ref-1',
        afterDays: 2,
      }),
      balances: [],
    });
    const since = new Date('2026-09-30T00:00:00Z');

    const day1 = await connector.fetchTransactions(fetchInput(since));
    clock.set(DAY_2);
    const day2 = await connector.fetchTransactions(fetchInput(since));
    clock.set(DAY_3);
    const day3 = await connector.fetchTransactions(fetchInput(since));

    expect(day1).toEqual([PENDING_FUEL]);
    expect(day2).toEqual([PENDING_FUEL]);
    expect(day3).toEqual([
      {
        ...PENDING_FUEL,
        status: 'booked',
        entryReference: 'eb-ref-1',
        bookingDate: '2026-10-03',
        amountMinor: -18750n,
        direction: 'debit',
      },
    ]);
  });

  it('reports pending on day 1 and cancelled on day 2', async () => {
    connector.scriptAccount({
      account: ACCOUNT,
      snapshots: InMemoryBankScenarios.pendingThenCancelled(FUEL, 1),
      balances: [],
    });
    const since = new Date('2026-09-30T00:00:00Z');

    const day1 = await connector.fetchTransactions(fetchInput(since));
    clock.set(DAY_2);
    const day2 = await connector.fetchTransactions(fetchInput(since));

    expect(day1).toEqual([PENDING_FUEL]);
    expect(day2).toEqual([{ ...PENDING_FUEL, status: 'cancelled' }]);
  });

  it('reports nothing before the first snapshot or for an unscripted account', async () => {
    clock.set(new Date('2026-09-30T09:00:00Z'));
    connector.scriptAccount({
      account: ACCOUNT,
      snapshots: InMemoryBankScenarios.pendingThenCancelled(FUEL, 1),
      balances: [],
    });

    await expect(connector.fetchTransactions(fetchInput(DAY_1))).resolves.toEqual([]);
    await expect(
      connector.fetchTransactions({ ...fetchInput(DAY_1), account: { externalId: 'other' } }),
    ).resolves.toEqual([]);
  });

  it('filters by dateFrom on the default strategy and returns everything on longest', async () => {
    connector.scriptAccount({
      account: ACCOUNT,
      snapshots: InMemoryBankScenarios.pendingThenCancelled(FUEL, 1),
      balances: [],
    });
    const afterThePayment = new Date('2026-10-02T00:00:00Z');

    const filtered = await connector.fetchTransactions(fetchInput(afterThePayment));
    const longest = await connector.fetchTransactions({
      ...fetchInput(afterThePayment),
      strategy: 'longest',
    });

    expect(filtered).toEqual([]);
    expect(longest).toEqual([PENDING_FUEL]);
  });

  it('lists the scripted accounts and their balances', async () => {
    const balance = {
      accountExternalId: 'acc-pln',
      amount: { amountMinor: 123456n, currency: 'PLN' },
      balanceType: 'CLBD',
      referenceDate: IsoDate.of('2026-10-01'),
    };
    connector.scriptAccount({ account: ACCOUNT, snapshots: [], balances: [balance] });

    await expect(connector.listAccounts()).resolves.toEqual([ACCOUNT]);
    await expect(
      connector.fetchBalances({ account: { externalId: 'acc-pln' }, consent: CONSENT, psu: null }),
    ).resolves.toEqual([balance]);
  });

  it('reports an active consent until a test sets another status', async () => {
    await expect(connector.getConsentStatus()).resolves.toEqual({
      status: 'active',
      validUntil: null,
    });

    const validUntil = new Date('2027-03-30T00:00:00Z');
    connector.setConsentStatus({ status: 'revoked', validUntil });

    await expect(connector.getConsentStatus()).resolves.toEqual({ status: 'revoked', validUntil });
  });

  it('dates the consent expiry from its clock', async () => {
    const result = await connector.completeConsent({
      externalConsentRef: 'ref',
      callbackPayload: {},
    });

    expect(result.expiresAt).toEqual(new Date('2026-12-30T09:00:00Z'));
  });
});
