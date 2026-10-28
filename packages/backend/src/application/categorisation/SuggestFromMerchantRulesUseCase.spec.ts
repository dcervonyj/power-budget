import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, PlannedItemId, UserId, MerchantRuleId } from '@power-budget/core';
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

const household = 'hh-1' as HouseholdId;
const owner = 'u-1' as UserId;
const hintItem = 'item-hint' as PlannedItemId;

const WEAK_HINT: TransactionSuggestionFields = {
  suggestedPlannedItemId: hintItem,
  suggestedCategoryId: null,
  suggestionConfidence: 0.8,
  suggestionSource: 'planned_hint',
  autoMapped: false,
};

function row(): NewTransaction {
  return mock<NewTransaction>({
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
  const rules = mock<MerchantRuleRepository>();
  rules.findMatching.mockResolvedValue([
    mock<MerchantRule>({ id: 'r1' as MerchantRuleId, alwaysAsk: false, hits, planKindPref: null }),
  ]);
  const items = mock<PlannedItemResolver>();
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
    const [result] = await useCaseWith(1, 'item-rule' as PlannedItemId).suggest(
      [row()],
      owner,
      household,
    );

    expect(result?.suggestion).toMatchObject({
      suggestionSource: 'planned_hint',
      suggestedPlannedItemId: hintItem,
    });
  });

  it('replaces the hint with a rule that resolves to a planned item with higher confidence', async () => {
    const [result] = await useCaseWith(3, 'item-rule' as PlannedItemId).suggest(
      [row()],
      owner,
      household,
    );

    expect(result?.suggestion).toMatchObject({
      suggestedPlannedItemId: 'item-rule',
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    });
  });
});
