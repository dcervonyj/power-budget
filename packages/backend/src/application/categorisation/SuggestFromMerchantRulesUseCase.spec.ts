import { describe, expect, it } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, PlannedItemId, UserId, MerchantRuleId } from '@power-budget/core';
import { IsoDate, Money } from '@power-budget/core';
import { SuggestFromMerchantRulesUseCase } from './SuggestFromMerchantRulesUseCase.js';
import type { MerchantRule } from '../../domain/categorisation/entities.js';
import type {
  MerchantRuleRepository,
  PlannedItemResolver,
} from '../../domain/categorisation/ports.js';
import type {
  NewTransaction,
  TransactionSuggestionFields,
} from '../../domain/transactions/entities.js';

const household = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const owner = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
const hintItem = PlannedItemId.of('01900000-4887-725c-8516-662967c45e4c');

const WEAK_HINT: TransactionSuggestionFields = {
  suggestedPlannedItemId: hintItem,
  suggestedCategoryId: null,
  suggestionConfidence: 0.8,
  suggestionSource: 'planned_hint',
  autoMapped: false,
};

function row(): NewTransaction {
  return createMock<NewTransaction>({
    ignored: false,
    merchant: 'Biedronka',
    description: 'Card payment',
    occurredOn: IsoDate.of('2026-10-05'),
    amount: Money.of(-4500n, 'PLN'),
    suggestion: WEAK_HINT,
    bank: { counterpartyIbanHash: null, counterpartyName: 'Biedronka' },
  });
}

function useCaseWith(
  hits: number,
  resolved: PlannedItemId | null,
): SuggestFromMerchantRulesUseCase {
  const rules = createMock<MerchantRuleRepository>();
  rules.findMatching.mockResolvedValue([
    createMock<MerchantRule>({
      id: MerchantRuleId.of('01900000-5573-7e39-8b66-00496d40f493'),
      alwaysAsk: false,
      hits,
      planKindPref: null,
    }),
  ]);
  const items = createMock<PlannedItemResolver>();
  items.resolveActive.mockResolvedValue(resolved === null ? null : { plannedItemId: resolved });

  return new SuggestFromMerchantRulesUseCase(rules, items);
}

describe('SuggestFromMerchantRulesUseCase over a weak planned hint (AI-004)', () => {
  it('keeps the hint when the rule resolves to no planned item', async () => {
    const [result] = await useCaseWith(5, null).suggest([row()], owner, household);

    expect(result?.suggestion).toMatchObject({
      suggestionSource: 'planned_hint',
      suggestedPlannedItemId: hintItem,
    });
  });

  it('keeps the hint when the rule is not more confident than the hint', async () => {
    const [result] = await useCaseWith(
      1,
      PlannedItemId.of('01900000-56f7-768d-804b-f5a2bc0a6fa6'),
    ).suggest([row()], owner, household);

    expect(result?.suggestion).toMatchObject({
      suggestionSource: 'planned_hint',
      suggestedPlannedItemId: hintItem,
    });
  });

  it('replaces the hint with a rule that resolves to a planned item with higher confidence', async () => {
    const [result] = await useCaseWith(
      3,
      PlannedItemId.of('01900000-56f7-768d-804b-f5a2bc0a6fa6'),
    ).suggest([row()], owner, household);

    expect(result?.suggestion).toMatchObject({
      suggestedPlannedItemId: '01900000-56f7-768d-804b-f5a2bc0a6fa6',
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    });
  });
});
