import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  BankAccountId,
  CategoryId,
  FxRateId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
import type { FxRate, FxRateTable, Mapping, Transaction } from '@power-budget/core';
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
import { testUuid } from '../../test/doubles/testUuid.js';

const HH = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const ANN = UserId.of('01900000-df75-7d2d-8df4-707b8b171d37');
const BOB = UserId.of('01900000-2f5d-7fe5-8e88-c03764db3083');
const ITEM = PlannedItemId.of('01900000-8d6b-76cf-88e6-806f74576ba2');

const PLAN_ID = PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c');

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    householdId: HH,
    ownerUserId: null,
    name: 'October',
    type: 'household',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function item(overrides: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id: ITEM,
    planId: PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c'),
    householdId: HH,
    categoryId: CategoryId.of('01900000-2548-776e-8414-dc1c91b1b01c'),
    direction: 'expense',
    amount: { amountMinor: 10_000n, currency: 'PLN' },
    note: null,
    matchHint: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function tx(id: string, amountMinor: bigint, currency: 'PLN' | 'EUR' | 'USD' = 'PLN'): Transaction {
  return {
    id: TransactionId.of(testUuid(id)),
    householdId: HH,
    accountId: BankAccountId.of('01900000-998a-733e-8778-f641457f6a29'),
    externalId: null,
    source: 'bank',
    status: 'booked',
    amount: { amountMinor, currency },
    description: id,
    merchantName: null,
    bookedAt: IsoDate.of('2026-10-10'),
    createdAt: IsoDateTime.of('2026-10-10T00:00:00Z'),
    ignored: false,
  };
}

function mapping(txId: string): Mapping {
  return {
    id: TransactionMappingId.of(testUuid(txId)),
    householdId: HH,
    transactionId: TransactionId.of(testUuid(txId)),
    plannedItemId: ITEM,
    createdByUserId: ANN,
    createdAt: IsoDateTime.of('2026-10-10T00:00:00Z'),
  };
}

function eurPln(): FxRateTable {
  const rate: FxRate = {
    id: FxRateId.of('01900000-94c9-799f-880a-403271315132'),
    baseCurrency: 'EUR',
    quoteCurrency: 'PLN',
    rate: '4.25',
    rateDate: IsoDate.of('2026-10-20'),
    source: 'ecb',
    fetchedAt: IsoDateTime.of('2026-10-20T16:00:00Z'),
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
    owners: new Map(transactions.map((t) => [t.id, t.description.startsWith('ann') ? ANN : BOB])),
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
    ).rejects.toThrow(`UNSUPPORTED_CURRENCY: Plan ${PLAN_ID} has base currency XYZ`);
  });

  it('passes any other error through the FX translation unchanged', () => {
    const loader = new PlanFxRatesLoader(mock<FxRateRepository>());
    const failure = new Error('connection lost');

    expect(
      loader.translateError(failure, { rateDate: IsoDate.of('2026-10-20'), table: new Map() }),
    ).toBe(failure);
  });

  it('loads the FX table once per rate date for all plans of a run-scoped reader', async () => {
    const { service, fxRepo } = setup();
    const scoped = service.runScoped();
    const asOf = new Date('2026-10-20T12:00:00Z');

    await scoped.read(plan(), asOf);
    await scoped.read(plan({ id: PlanId.of('01900000-1e38-78c5-8214-74c7d1dc7342') }), asOf);

    expect(fxRepo.getTable).toHaveBeenCalledTimes(1);

    await service.read(plan(), asOf);
    await service.read(plan(), asOf);

    expect(fxRepo.getTable).toHaveBeenCalledTimes(3);
  });
});
