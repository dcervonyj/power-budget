import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import type { HintedPlannedItem } from '../../../domain/categorisation/entities.js';
import type { PlannedHintReader } from '../../../domain/categorisation/ports.js';
import { NO_BANK_DETAILS, type NewTransaction } from '../../../domain/transactions/entities.js';
import { SuggestFromPlannedHintsUseCase } from '../SuggestFromPlannedHintsUseCase.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const userId = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
const categoryId = CategoryId.of('01900000-14d6-7e74-84a3-1f4de45f1374');

function item(id: string, overrides: Partial<HintedPlannedItem> = {}): HintedPlannedItem {
  return {
    plannedItemId: PlannedItemId.of(testUuid(id)),
    categoryId,
    direction: 'expense',
    amount: { amountMinor: 340000n, currency: 'PLN' },
    matchHint: {
      counterpartyPattern: 'Landlord',
      amount: { amountMinor: 340000n, toleranceMinor: 0n },
      day: { dayOfMonth: 5, window: 2 },
    },
    periodStart: IsoDate.of('2026-10-01'),
    periodEnd: IsoDate.of('2026-10-31'),
    ...overrides,
  };
}

function row(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    id: TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f'),
    householdId,
    accountId: BankAccountId.of(testUuid('acc-1')),
    externalId: 'e-1',
    source: 'bank_sync',
    sourceKind: null,
    status: 'booked',
    occurredOn: IsoDate.of('2026-10-05'),
    amount: { amountMinor: -340000n, currency: 'PLN' },
    description: 'Czynsz',
    merchant: 'Landlord Sp. z o.o.',
    ignored: false,
    bank: { ...NO_BANK_DETAILS, counterpartyName: 'Landlord' },
    ...overrides,
  };
}

function useCase(items: readonly HintedPlannedItem[]): SuggestFromPlannedHintsUseCase {
  const reader = mock<PlannedHintReader>();
  reader.listHinted.mockResolvedValue([...items]);

  return new SuggestFromPlannedHintsUseCase(reader);
}

describe('SuggestFromPlannedHintsUseCase', () => {
  it('auto-maps a unique full hint match with the planned_hint source', async () => {
    const [result] = await useCase([item('rent')]).suggest([row()], userId, householdId);

    expect(result?.suggestion).toEqual({
      suggestedPlannedItemId: testUuid('rent'),
      suggestedCategoryId: categoryId,
      suggestionConfidence: 0.99,
      suggestionSource: 'planned_hint',
      autoMapped: true,
    });
  });

  it('only suggests when two planned items match, never auto-maps', async () => {
    const [result] = await useCase([item('rent-a'), item('rent-b')]).suggest(
      [row()],
      userId,
      householdId,
    );

    expect(result?.suggestion).toMatchObject({
      suggestionSource: 'planned_hint',
      suggestionConfidence: 0.9,
      autoMapped: false,
    });
  });

  it('ignores a plan that does not cover the transaction date', async () => {
    const november = item('rent-nov', {
      periodStart: IsoDate.of('2026-11-01'),
      periodEnd: IsoDate.of('2026-11-30'),
    });
    const [result] = await useCase([november]).suggest([row()], userId, householdId);

    expect(result?.suggestion).toBeUndefined();
  });

  it('matches an income row by its positive amount and direction', async () => {
    const salary = item('salary', {
      direction: 'income',
      matchHint: { counterpartyPattern: 'Acme', amount: null, day: null },
    });
    const income = row({
      amount: { amountMinor: 900000n, currency: 'PLN' },
      merchant: 'Acme Corp',
    });
    const [result] = await useCase([salary]).suggest([income], userId, householdId);

    expect(result?.suggestion).toMatchObject({
      suggestedPlannedItemId: testUuid('salary'),
      suggestionConfidence: 0.9,
      autoMapped: false,
    });
  });

  it('leaves ignored rows and rows with a suggestion untouched, and queries once per batch', async () => {
    const reader = mock<PlannedHintReader>();
    reader.listHinted.mockResolvedValue([item('rent')]);
    const suggested = row({
      suggestion: {
        suggestedPlannedItemId: null,
        suggestedCategoryId: null,
        suggestionConfidence: 0.5,
        suggestionSource: 'transfer_rule',
        autoMapped: false,
      },
    });
    const ignored = row({ ignored: true });

    const result = await new SuggestFromPlannedHintsUseCase(reader).suggest(
      [suggested, ignored],
      userId,
      householdId,
    );

    expect(result).toEqual([suggested, ignored]);
    expect(reader.listHinted).toHaveBeenCalledTimes(1);
  });

  it('skips the lookup when every row is ignored', async () => {
    const reader = mock<PlannedHintReader>();

    await new SuggestFromPlannedHintsUseCase(reader).suggest(
      [row({ ignored: true })],
      userId,
      householdId,
    );

    expect(reader.listHinted).not.toHaveBeenCalled();
  });
});
