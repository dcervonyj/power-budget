import type { HouseholdId, PlannedItemId, UserId } from '@power-budget/core';
import type {
  MerchantRuleRepository,
  PlannedItemResolver,
} from '../../domain/categorisation/ports.js';
import { merchantRuleKeysOf } from '../../domain/categorisation/merchant-rule-keys.js';
import type { Transaction } from '../../domain/transactions/entities.js';

export interface LearnFromMappingInput {
  readonly transaction: Transaction;
  readonly plannedItemId: PlannedItemId;
  readonly by: UserId;
  readonly householdId: HouseholdId;
}

/**
 * Merchant memory (AI-003): a user's MapTransaction teaches the rule "this merchant belongs to
 * this category (and plan kind)". The most recent correction wins; each one counts as a hit.
 */
export class LearnMerchantRuleUseCase {
  constructor(
    private readonly rules: MerchantRuleRepository,
    private readonly plannedItems: PlannedItemResolver,
    private readonly now: () => Date,
    private readonly warn: (message: string) => void,
  ) {}

  /**
   * Best effort: the mapping is already saved, so a failed rule is logged and never fails the
   * request.
   */
  async learnFromMapping(input: LearnFromMappingInput): Promise<void> {
    try {
      await this.learn(input);
    } catch (error) {
      this.warn(`Merchant memory skipped for ${input.transaction.id}: ${String(error)}`);
    }
  }

  private async learn(input: LearnFromMappingInput): Promise<void> {
    const { transaction } = input;
    const keys = merchantRuleKeysOf({
      counterpartyIbanHash: transaction.bank.counterpartyIbanHash,
      counterpartyName: transaction.bank.counterpartyName,
      merchant: transaction.merchant,
      description: transaction.description,
    });
    if (keys.length === 0) {
      return;
    }

    const profile = await this.plannedItems.describe(input.plannedItemId, input.householdId);
    if (profile === null) {
      return;
    }

    await this.rules.recordCorrection({
      householdId: input.householdId,
      ownerUserId: input.by,
      keys,
      categoryId: profile.categoryId,
      planKindPref: profile.planKind,
      alwaysAsk: false,
      createdFromTx: transaction.id,
      by: input.by,
      at: this.now(),
    });
  }
}
