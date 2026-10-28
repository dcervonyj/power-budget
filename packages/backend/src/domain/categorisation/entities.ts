import type {
  CategoryId,
  HintCandidate,
  HouseholdId,
  IsoDate,
  PlanType,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';

export type MerchantMatchKind = 'merchant' | 'counterparty_iban_hash' | 'descriptor_regex';

/** One way to recognise a counterparty: a normalised merchant key or a counterparty IBAN hash. */
export interface MerchantRuleKey {
  readonly matchKind: MerchantMatchKind;
  readonly pattern: string;
}

/** `merchant_rules` (plan-banking.md §1.13): what the user taught the app about a merchant. */
export interface MerchantRule extends MerchantRuleKey {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId | null;
  readonly categoryId: CategoryId;
  readonly planKindPref: PlanType | null;
  /** Never suggest: the user wants to be asked every time. */
  readonly alwaysAsk: boolean;
  /** How many corrections taught or confirmed the rule (suggesting it at ingest is not a hit). */
  readonly hits: number;
  readonly lastHitAt: Date | null;
  readonly createdFromTx: TransactionId | null;
  readonly createdBy: UserId;
}

/** A user correction (a MapTransaction or a question answer) to learn from. */
export interface MerchantCorrection {
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId;
  readonly keys: readonly MerchantRuleKey[];
  readonly categoryId: CategoryId;
  readonly planKindPref: PlanType | null;
  readonly alwaysAsk: boolean;
  readonly createdFromTx: TransactionId;
  readonly by: UserId;
  readonly at: Date;
}

/** The category and plan kind of a planned item the user mapped a transaction to. */
export interface PlannedItemProfile {
  readonly categoryId: CategoryId;
  readonly planKind: PlanType;
}

/** The planned item a rule points at for one transaction date and owner. */
export interface PlannedItemQuery {
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId;
  readonly categoryId: CategoryId;
  readonly planKindPref: PlanType | null;
  readonly direction: 'income' | 'expense';
  readonly occurredOn: IsoDate;
}

/** A planned item with a match hint that may pay a transaction (AI-004). */
export interface HintedPlannedItem extends HintCandidate {
  readonly categoryId: CategoryId;
  /** The period of the item's plan: the hint only applies to dates inside it. */
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
}

export interface HintedPlannedItemQuery {
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId;
  /** Plans overlapping [from, to] are returned. */
  readonly from: IsoDate;
  readonly to: IsoDate;
}

export interface ResolvedPlannedItem {
  readonly plannedItemId: PlannedItemId;
}
