import type { HouseholdId, PlannedItemId, UserId } from '@power-budget/core';
import type { MerchantRule } from '../../domain/categorisation/entities.js';
import type {
  MerchantRuleRepository,
  PlannedItemResolver,
} from '../../domain/categorisation/ports.js';
import {
  merchantRuleConfidence,
  merchantRuleKeysOf,
} from '../../domain/categorisation/merchant-rule-keys.js';
import type {
  NewTransaction,
  TransactionSuggestionFields,
} from '../../domain/transactions/entities.js';

/**
 * Merchant memory at ingest (AI-003): looks the row up in the account owner's rules and
 * resolves the rule's category to the planned item of the plan that is active on the
 * transaction date, so a November row lands in November's item. It only suggests; the
 * confidence policy of AI-006 decides about auto-mapping.
 */
export class SuggestFromMerchantRulesUseCase {
  constructor(
    private readonly rules: MerchantRuleRepository,
    private readonly plannedItems: PlannedItemResolver,
  ) {}

  async suggest(
    rows: readonly NewTransaction[],
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<NewTransaction[]> {
    const itemByRuleAndDate = new Map<string, PlannedItemId | null>();
    const result: NewTransaction[] = [];
    for (const row of rows) {
      const suggestion = await this.suggestionFor(row, ownerUserId, householdId, itemByRuleAndDate);
      result.push(suggestion === null ? row : { ...row, suggestion });
    }

    return result;
  }

  private async suggestionFor(
    row: NewTransaction,
    ownerUserId: UserId,
    householdId: HouseholdId,
    itemByRuleAndDate: Map<string, PlannedItemId | null>,
  ): Promise<TransactionSuggestionFields | null> {
    if (row.ignored) {
      return null;
    }

    const keys = merchantRuleKeysOf({
      counterpartyIbanHash: row.bank.counterpartyIbanHash,
      counterpartyName: row.bank.counterpartyName,
      merchant: row.merchant,
      description: row.description,
    });
    if (keys.length === 0) {
      return null;
    }

    const matches = await this.rules.findMatching(keys, ownerUserId, householdId);
    const rule = matches[0];
    if (rule === undefined || rule.alwaysAsk) {
      return null;
    }

    const cacheKey = `${rule.id}|${row.occurredOn}|${row.amount.amountMinor < 0n ? 'expense' : 'income'}`;
    let plannedItemId = itemByRuleAndDate.get(cacheKey);
    if (plannedItemId === undefined) {
      plannedItemId = await this.resolve(rule, row, ownerUserId, householdId);
      itemByRuleAndDate.set(cacheKey, plannedItemId);
    }

    return {
      suggestedPlannedItemId: plannedItemId,
      suggestedCategoryId: rule.categoryId,
      suggestionConfidence: merchantRuleConfidence(rule.hits),
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    };
  }

  private async resolve(
    rule: MerchantRule,
    row: NewTransaction,
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<PlannedItemId | null> {
    const resolved = await this.plannedItems.resolveActive({
      householdId,
      ownerUserId,
      categoryId: rule.categoryId,
      planKindPref: rule.planKindPref,
      direction: row.amount.amountMinor < 0n ? 'expense' : 'income',
      occurredOn: row.occurredOn,
    });

    return resolved === null ? null : resolved.plannedItemId;
  }
}
