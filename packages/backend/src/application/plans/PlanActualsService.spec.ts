import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  BankAccountId,
  CategoryId,
  FxRate,
  FxRateId,
  FxRateTable,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  Mapping,
  PlanId,
  PlannedItemId,
  Transaction,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
import type { Plan, PlannedItem } from '../../domain/plans/entities.js';
import type {
  PlanActivity,
  PlanActivityReader,
  PlannedItemRepository,
} from '../../domain/plans/ports.js';
import type { FxRateRepository } from '../../domain/fx/index.js';
import { FX_CARRY_FORWARD_DAYS } from '../../domain/fx/index.js';
import { PlanActualsService } from './PlanActualsService.js';
import { PlanFxRatesLoader } from './plan-fx-rates.js';

const HH = 'hh-1' as HouseholdId;
const ANN = 'u-ann' as UserId;
const BOB = 'u-bob' as UserId;
const ITEM = 'item-1' as PlannedItemId;

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1' as PlanId,
    householdId: HH,
    ownerUserId: null,
    name: 'October',
    type: 'household',
    periodKind: 'monthly',
    period: { start: '2026-10-01' as IsoDate, end: '2026-10-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

function item(overrides: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id: ITEM,
    planId: 'plan-1' as PlanId,
    householdId: HH,
    categoryId: 'cat-1' as CategoryId,
    direction: 'expense',
    amount: { amountMinor: 10_000n, currency: 'PLN' },
    note: null,
    matchHint: null,
    createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

function tx(id: string, amountMinor: bigint, currency: 'PLN' | 'EUR' | 'USD' = 'PLN'): Transaction {
  return {
    id: id as TransactionId,
    householdId: HH,
    accountId: 'acc-1' as BankAccountId,
    externalId: null,
    source: 'bank',
    status: 'booked',
    amount: { amountMinor, currency },
    description: id,
    merchantName: null,
    bookedAt: '2026-10-10' as IsoDate,
    createdAt: '2026-10-10T00:00:00Z' as IsoDateTime,
    ignored: false,
  };
}

function mapping(txId: string): Mapping {
  return {
    id: txId as TransactionMappingId,
    householdId: HH,
    transactionId: txId as TransactionId,
    plannedItemId: ITEM,
    createdByUserId: ANN,
    createdAt: '2026-10-10T00:00:00Z' as IsoDateTime,
  };
}

function eurPln(): FxRateTable {
  const rate: FxRate = {
    id: 'fx-1' as FxRateId,
    baseCurrency: 'EUR',
    quoteCurrency: 'PLN',
    rate: '4.25',
    rateDate: '2026-10-20' as IsoDate,
    source: 'ecb',
    fetchedAt: '2026-10-20T16:00:00Z' as IsoDateTime,
  };

  return new Map([['EUR/PLN', rate]]);
}

/** Ann owns ann-*, Bob owns bob-*. ann-mapped is mapped to the plan's item. */
function activity(): PlanActivity {
  const transactions = [
    tx('ann-mapped', -2_000n),
    tx('ann-free', -300n),
    tx('bob-free', -100n, 'EUR'),
  ];

  return {
    transactions,
    owners: new Map(transactions.map((t) => [t.id, t.id.startsWith('ann') ? ANN : BOB])),
    mappings: [mapping('ann-mapped')],
    transfers: [],
  };
}

function setup(table: FxRateTable = eurPln()): {
  service: PlanActualsService;
  fxRepo: ReturnType<typeof mock<FxRateRepository>>;
  activityReader: ReturnType<typeof mock<PlanActivityReader>>;
} {
  const items = mock<PlannedItemRepository>();
  items.listByPlan.mockResolvedValue([item()]);
  const activityReader = mock<PlanActivityReader>();
  activityReader.read.mockResolvedValue(activity());
  const fxRepo = mock<FxRateRepository>();
  fxRepo.getTable.mockResolvedValue(table);

  return {
    service: new PlanActualsService(items, activityReader, new PlanFxRatesLoader(fxRepo)),
    fxRepo,
    activityReader,
  };
}

describe('PlanActualsService', () => {
  it('computes a household plan in core with every member transaction converted', async () => {
    const { service, activityReader } = setup();

    const view = await service.read(plan(), new Date('2026-10-20T12:00:00Z'));

    expect(activityReader.read).toHaveBeenCalledWith({
      householdId: HH,
      period: { start: '2026-10-01', end: '2026-10-31' },
    });
    expect(view.expenseLines[0]!.actual).toEqual({ amountMinor: 2_000n, currency: 'PLN' });
    // 3.00 PLN of Ann + 1.00 EUR of Bob = 4.25 PLN
    expect(view.unplannedExpenses).toEqual({ amountMinor: 725n, currency: 'PLN' });
    expect(view.asOf).toBe('2026-10-20');
  });

  it("leaves the partner's transactions out of a personal plan", async () => {
    const { service } = setup();

    const view = await service.read(
      plan({ type: 'personal', ownerUserId: ANN }),
      new Date('2026-10-20T12:00:00Z'),
    );

    expect(view.expenseLines[0]!.actual.amountMinor).toBe(2_000n);
    expect(view.unplannedExpenses).toEqual({ amountMinor: 300n, currency: 'PLN' });
  });

  it("still counts a partner's transaction mapped to the personal plan", async () => {
    const { service } = setup();

    const view = await service.read(
      plan({ type: 'personal', ownerUserId: BOB }),
      new Date('2026-10-20T12:00:00Z'),
    );

    expect(view.expenseLines[0]!.actual.amountMinor).toBe(2_000n);
    expect(view.unplannedExpenses).toEqual({ amountMinor: 425n, currency: 'PLN' });
  });

  it('takes the rates for the period end once the period is over', async () => {
    const { service, fxRepo } = setup();

    await service.read(plan(), new Date('2026-11-15T08:00:00Z'));

    expect(fxRepo.getTable).toHaveBeenCalledWith('2026-10-31', FX_CARRY_FORWARD_DAYS);
  });

  it('takes the rates for today while the period runs', async () => {
    const { service, fxRepo } = setup();

    await service.read(plan(), new Date('2026-10-20T08:00:00Z'));

    expect(fxRepo.getTable).toHaveBeenCalledWith('2026-10-20', FX_CARRY_FORWARD_DAYS);
  });

  it('throws FX_RATE_UNAVAILABLE when a rate is missing', async () => {
    const { service } = setup(new Map());

    await expect(service.read(plan(), new Date('2026-10-20T12:00:00Z'))).rejects.toThrow(
      'FX_RATE_UNAVAILABLE: EUR/PLN for 2026-10-20',
    );
  });

  it('throws UNSUPPORTED_CURRENCY for an unknown base currency', async () => {
    const { service } = setup();

    await expect(
      service.read(plan({ baseCurrency: 'XYZ' }), new Date('2026-10-20T12:00:00Z')),
    ).rejects.toThrow('UNSUPPORTED_CURRENCY: Plan plan-1 has base currency XYZ');
  });

  it('passes any other error through the FX translation unchanged', () => {
    const loader = new PlanFxRatesLoader(mock<FxRateRepository>());
    const failure = new Error('connection lost');

    expect(
      loader.translateError(failure, { rateDate: '2026-10-20' as IsoDate, table: new Map() }),
    ).toBe(failure);
  });

  it('loads the FX table once per rate date for all plans of a run-scoped reader', async () => {
    const { service, fxRepo } = setup();
    const scoped = service.runScoped();
    const asOf = new Date('2026-10-20T12:00:00Z');

    await scoped.read(plan(), asOf);
    await scoped.read(plan({ id: 'plan-2' as PlanId }), asOf);

    expect(fxRepo.getTable).toHaveBeenCalledTimes(1);

    await service.read(plan(), asOf);
    await service.read(plan(), asOf);

    expect(fxRepo.getTable).toHaveBeenCalledTimes(3);
  });
});
