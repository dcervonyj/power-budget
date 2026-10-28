import type { HouseholdId, PlannedItemId, UserId } from '@power-budget/core';
import type {
  MerchantCorrection,
  MerchantRule,
  MerchantRuleKey,
  PlannedItemProfile,
  PlannedItemQuery,
  ResolvedPlannedItem,
} from './entities.js';

export interface MerchantRuleRepository {
  /**
   * Upserts one rule per key: a conflicting rule is overwritten (the most recent correction
   * wins, `always_ask` included) and its hit count goes up by one.
   */
  recordCorrection(correction: MerchantCorrection): Promise<void>;
  /**
   * The rules of the household and owner that match any of `keys`, in the order of `keys`
   * (the first key is the strongest). An owner-less rule matches every owner.
   */
  findMatching(
    keys: readonly MerchantRuleKey[],
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<MerchantRule[]>;
}

export interface PlannedItemResolver {
  /** The category and plan kind of a planned item, or null when it is not in the household. */
  describe(
    plannedItemId: PlannedItemId,
    householdId: HouseholdId,
  ): Promise<PlannedItemProfile | null>;
  /**
   * The planned item of the plan whose period holds `occurredOn` (not archived, owned by the
   * owner or the household) in the category and direction. A plan of the preferred kind wins,
   * then the owner's own plan; null when no plan covers the date.
   */
  resolveActive(query: PlannedItemQuery): Promise<ResolvedPlannedItem | null>;
}
