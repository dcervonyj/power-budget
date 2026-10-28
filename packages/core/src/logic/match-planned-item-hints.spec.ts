import { describe, expect, it } from 'vitest';
import { PlannedItemId } from '../domain/plans/ids.js';
import type { PlannedItemMatchHint } from '../domain/plans/match-hint.js';
import { IsoDate } from '../domain/shared/ids.js';
import { Money } from '../domain/shared/money.js';
import {
  matchPlannedItemHints,
  type HintCandidate,
  type HintTransaction,
} from './match-planned-item-hints.js';

const ID = {
  i1: '01900000-0000-7000-8000-000000000001',
  i2: '01900000-0000-7000-8000-000000000002',
  i3: '01900000-0000-7000-8000-000000000003',
  i4: '01900000-0000-7000-8000-000000000004',
  i6: '01900000-0000-7000-8000-000000000006',
  i5: '01900000-0000-7000-8000-000000000005',
  i7: '01900000-0000-7000-8000-000000000007',
  i8: '01900000-0000-7000-8000-000000000008',
  i9: '01900000-0000-7000-8000-000000000009',
  i10: '01900000-0000-7000-8000-000000000010',
} as const;

const NO_HINT: PlannedItemMatchHint = { counterpartyPattern: null, amount: null, day: null };

function candidate(id: string, hint: Partial<PlannedItemMatchHint>, over?: Partial<HintCandidate>) {
  return {
    plannedItemId: PlannedItemId.of(id),
    direction: 'expense',
    amount: Money.of(300_000n, 'PLN'),
    matchHint: { ...NO_HINT, ...hint },
    ...over,
  } satisfies HintCandidate;
}

function tx(over?: Partial<HintTransaction>): HintTransaction {
  return {
    direction: 'expense',
    amount: Money.of(-300_000n, 'PLN'),
    occurredOn: IsoDate.of('2026-10-05'),
    description: 'Czynsz za pazdziernik',
    merchant: null,
    counterparty: 'Jan Kowalski',
    ...over,
  };
}

const RENT = {
  counterpartyPattern: 'kowalski',
  amount: { amountMinor: 300_000n, toleranceMinor: 5_000n },
  day: { dayOfMonth: 5, window: 3 },
};

describe('matchPlannedItemHints', () => {
  it('auto-maps a unique rent match on counterparty, amount and day', () => {
    expect(matchPlannedItemHints(tx(), [candidate(ID.i1, RENT)])).toEqual({
      plannedItemId: ID.i1,
      confidence: 0.99,
      autoMap: true,
      matchCount: 1,
    });
  });

  it('auto-maps a salary and a subscription on counterparty plus amount', () => {
    const salary = candidate(
      ID.i2,
      {
        counterpartyPattern: 'ACME Sp. z o.o.',
        amount: { amountMinor: 900_000n, toleranceMinor: 0n },
      },
      { direction: 'income' },
    );
    const salaryTx = tx({
      direction: 'income',
      amount: Money.of(900_000n, 'PLN'),
      counterparty: 'Acme sp z o o',
    });
    expect(matchPlannedItemHints(salaryTx, [salary])).toMatchObject({
      confidence: 0.97,
      autoMap: true,
    });

    const netflix = candidate(ID.i3, {
      counterpartyPattern: 'netflix',
      amount: { amountMinor: 4_300n, toleranceMinor: 100n },
    });
    const netflixTx = tx({
      amount: Money.of(-4_399n, 'PLN'),
      merchant: 'NETFLIX.COM',
      counterparty: null,
    });
    expect(matchPlannedItemHints(netflixTx, [netflix])).toMatchObject({
      plannedItemId: ID.i3,
      autoMap: true,
    });
  });

  it('never auto-maps when two planned items match, and suggests the stronger one', () => {
    const weaker = candidate(ID.i4, { counterpartyPattern: 'kowalski' });
    const result = matchPlannedItemHints(tx(), [weaker, candidate(ID.i1, RENT)]);
    expect(result).toEqual({
      plannedItemId: ID.i1,
      confidence: 0.9,
      autoMap: false,
      matchCount: 2,
    });
  });

  it('breaks an exact tie by planned item id', () => {
    const result = matchPlannedItemHints(tx(), [candidate(ID.i6, RENT), candidate(ID.i5, RENT)]);
    expect(result).toMatchObject({ plannedItemId: ID.i5, autoMap: false, matchCount: 2 });
  });

  it('suggests without auto-mapping a unique match below the threshold', () => {
    const result = matchPlannedItemHints(tx(), [
      candidate(ID.i7, { counterpartyPattern: 'kowalski' }),
    ]);
    expect(result).toEqual({
      plannedItemId: ID.i7,
      confidence: 0.9,
      autoMap: false,
      matchCount: 1,
    });
  });

  it('returns null when a set part misses', () => {
    const wrongAmount = tx({ amount: Money.of(-310_000n, 'PLN') });
    const wrongDay = tx({ occurredOn: IsoDate.of('2026-10-20') });
    const wrongCurrency = tx({ amount: Money.of(-300_000n, 'EUR') });
    const wrongDirection = tx({ direction: 'income' });
    const wrongName = tx({ counterparty: 'Anna', description: 'x' });
    for (const t of [wrongAmount, wrongDay, wrongCurrency, wrongDirection, wrongName]) {
      expect(matchPlannedItemHints(t, [candidate(ID.i1, RENT)])).toBeNull();
    }
    expect(matchPlannedItemHints(tx(), [candidate(ID.i10, {})])).toBeNull();
    expect(matchPlannedItemHints(tx(), [])).toBeNull();
  });

  it('matches amounts at the tolerance edge in minor units', () => {
    const hint = { amount: { amountMinor: 1_000n, toleranceMinor: 50n } };
    expect(
      matchPlannedItemHints(tx({ amount: Money.of(1_050n, 'PLN') }), [candidate(ID.i8, hint)]),
    ).not.toBeNull();
    expect(
      matchPlannedItemHints(tx({ amount: Money.of(1_051n, 'PLN') }), [candidate(ID.i8, hint)]),
    ).toBeNull();
  });

  it('handles the day window across month ends and short months', () => {
    const day = (dayOfMonth: number, window: number) =>
      candidate(ID.i9, { day: { dayOfMonth, window } });
    expect(
      matchPlannedItemHints(tx({ occurredOn: IsoDate.of('2026-11-01') }), [day(30, 2)]),
    ).not.toBeNull();
    expect(
      matchPlannedItemHints(tx({ occurredOn: IsoDate.of('2026-10-29') }), [day(1, 3)]),
    ).not.toBeNull();
    expect(
      matchPlannedItemHints(tx({ occurredOn: IsoDate.of('2026-02-28') }), [day(31, 0)]),
    ).not.toBeNull();
    expect(
      matchPlannedItemHints(tx({ occurredOn: IsoDate.of('2026-10-15') }), [day(1, 3)]),
    ).toBeNull();
  });
});
