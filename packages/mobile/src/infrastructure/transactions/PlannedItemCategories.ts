import type { CategoriesApi, PlansApi } from '@power-budget/shared-app';
import type { PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';

/** A planned item of an active plan that a transaction can be sorted into. */
export interface PlannedItemOption {
  readonly plannedItemId: string;
  readonly planName: string;
  readonly categoryName: string;
}

/** Items of the active plans with their category names; the pool a transaction maps into. */
export async function loadPlannedItemOptions(
  plansApi: Pick<PlansApi, 'list' | 'listItems'>,
  categoriesApi: Pick<CategoriesApi, 'list'>,
): Promise<PlannedItemOption[]> {
  const [plans, categories] = await Promise.all([
    plansApi.list('active'),
    categoriesApi.list({ includeArchived: true }),
  ]);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const perPlan = await Promise.all(plans.map((plan) => optionsOf(plansApi, plan, names)));

  return perPlan.flat();
}

export function categoryNameByItem(
  options: readonly PlannedItemOption[],
): ReadonlyMap<string, string> {
  return new Map(options.map((option) => [option.plannedItemId, option.categoryName]));
}

async function optionsOf(
  plansApi: Pick<PlansApi, 'listItems'>,
  plan: PlanDto,
  names: ReadonlyMap<string, string>,
): Promise<PlannedItemOption[]> {
  const items = await plansApi.listItems(plan.id);

  return items.filter(isExpense).map((item) => ({
    plannedItemId: item.id,
    planName: plan.name,
    categoryName: names.get(item.categoryId) ?? '',
  }));
}

function isExpense(item: PlannedItemDto): boolean {
  return item.direction === 'expense';
}
