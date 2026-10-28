import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  CategoryId,
  HouseholdId,
  IsoDate,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import type { HintedPlannedItem } from '../../../domain/categorisation/entities.js';
import type { PlannedHintReader } from '../../../domain/categorisation/ports.js';
import type { NewTransaction } from '../../../domain/transactions/entities.js';
import { SuggestFromPlannedHintsUseCase } from '../SuggestFromPlannedHintsUseCase.js';

const householdId = 'hh-1' as HouseholdId;
const userId = 'u-1' as UserId;
const categoryId = 'cat-rent' as CategoryId;

function item(id: string, overrides: Partial<HintedPlannedItem> = {}): HintedPlannedItem {
  return {
    plannedItemId: id as PlannedItemId,
    categoryId,
    direction: 'expense',
    amount: { amountMinor: 340000n, currency: 'PLN' },
    matchHint: {
      counterpartyPattern: 'Landlord',
      amount: { amountMinor: 340000n, toleranceMinor: 0n },
      day: { dayOfMonth: 5, window: 2 },
    },
    periodStart: '2026-10-01' as IsoDate,
    periodEnd: '2026-10-31' as IsoDate,
    ...overrides,
  };
}

function row(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    id: 'tx-1' as TransactionId,
    householdId,
    accountId: 'acc-1',
    externalId: 'e-1',
    occurredOn: '2026-10-05' as IsoDate,
    amount: { amountMinor: -340000n, currency: 'PLN' },
    description: 'Czynsz',
    merchant: 'Landlord Sp. z o.o.',
    ignored: false,
    bank: { counterpartyName: 'Landlord' },
    ...overrides,
  } as NewTransaction;
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
      suggestedPlannedItemId: 'rent',
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
      periodStart: '2026-11-01' as IsoDate,
      periodEnd: '2026-11-30' as IsoDate,
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
      suggestedPlannedItemId: 'salary',
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
