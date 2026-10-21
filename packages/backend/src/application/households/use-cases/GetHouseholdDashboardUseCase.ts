import { aggregateByCategoryWithPrivacy } from '@power-budget/core';
import type {
  Category as CoreCategory,
  CategoryId,
  CategoryPrivacyLevel,
  HouseholdId,
  PlanId,
  PlannedItemId,
  TransactionId,
  UserId,
} from '@power-budget/core';
import type { Category } from '../../../domain/categories/entities.js';
import type {
  CategoryPrivacyRepository,
  CategoryRepository,
} from '../../../domain/categories/ports.js';
import type { PlannedItem } from '../../../domain/plans/entities.js';
import type {
  HouseholdDashboardData,
  HouseholdScope,
  PlanActivity,
  PlanActivityReader,
  PlannedItemRepository,
  PlanRepository,
} from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../../plans/plan-lookup.js';
import type { PlanFxRatesLoader } from '../../plans/plan-fx-rates.js';

export interface GetHouseholdDashboardInput {
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
  readonly viewerUserId: UserId;
  readonly asOf: Date;
}

/**
 * Per-category totals of a plan for the household view. Totals include both
 * members' transactions, converted into the plan's base currency; the partner's
 * transactions are only counted or listed as far as the category's privacy
 * level allows (core aggregateByCategoryWithPrivacy).
 */
export class GetHouseholdDashboardUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly itemRepo: PlannedItemRepository,
    private readonly activityReader: PlanActivityReader,
    private readonly categoryRepo: CategoryRepository,
    private readonly privacyRepo: CategoryPrivacyRepository,
    private readonly fxRates: PlanFxRatesLoader,
  ) {}

  async execute(input: GetHouseholdDashboardInput): Promise<HouseholdDashboardData> {
    // A partner's personal plan is not visible either (PLAN_NOT_FOUND).
    const plan = await findVisiblePlan(this.planRepo, {
      planId: input.planId,
      householdId: input.householdId,
      userId: input.viewerUserId,
    });
    const baseCurrency = this.fxRates.baseCurrencyOf(plan);
    const scope: HouseholdScope = { householdId: input.householdId };
    const [items, activity, categories, privacy, rates] = await Promise.all([
      this.itemRepo.listByPlan(plan.id, scope),
      this.activityReader.read({ householdId: input.householdId, period: plan.period }),
      this.categoryRepo.list(scope, { includeArchived: true }),
      this.privacyRepo.listByHousehold(scope),
      this.fxRates.load(plan, input.asOf),
    ]);
    const plannedCategories = new Set<CategoryId>(items.map((item) => item.categoryId));

    try {
      return {
        categories: aggregateByCategoryWithPrivacy({
          transactions: activity.transactions,
          txCategoryMap: this.categoryByTransaction(activity, items),
          txOwnerMap: activity.owners,
          categories: categories
            .filter((category) => this.isShown(category, plannedCategories))
            .map((category, index) => this.toCoreCategory(category, index)),
          viewerUserId: input.viewerUserId,
          privacyMap: new Map<CategoryId, CategoryPrivacyLevel>(
            privacy.map((row) => [row.categoryId, row.level]),
          ),
          transfers: activity.transfers,
          period: plan.period,
          baseCurrency,
          fxTable: rates.table,
        }),
      };
    } catch (error) {
      throw this.fxRates.translateError(error, rates);
    }
  }

  /** Transaction → category, through the mapping to one of this plan's items. */
  private categoryByTransaction(
    activity: PlanActivity,
    items: readonly PlannedItem[],
  ): Map<TransactionId, CategoryId> {
    const categoryOfItem = new Map<PlannedItemId, CategoryId>(
      items.map((item) => [item.id, item.categoryId]),
    );
    const result = new Map<TransactionId, CategoryId>();
    for (const mapping of activity.mappings) {
      const categoryId = categoryOfItem.get(mapping.plannedItemId);
      if (categoryId !== undefined) {
        result.set(mapping.transactionId, categoryId);
      }
    }

    return result;
  }

  /** Seeded and household categories; an archived one only while this plan still uses it. */
  private isShown(category: Category, plannedCategories: ReadonlySet<CategoryId>): boolean {
    return category.archivedAt === null || plannedCategories.has(category.id);
  }

  private toCoreCategory(category: Category, sortOrder: number): CoreCategory {
    return {
      id: category.id,
      householdId: category.householdId,
      name: category.name,
      kind: category.kind,
      sortOrder,
      isSystem: category.householdId === null,
      createdAt: category.createdAt,
    };
  }
}
