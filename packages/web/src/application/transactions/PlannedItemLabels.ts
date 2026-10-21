import type { PlansApi } from '@power-budget/shared-app';
import type { PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';

export interface PlannedItemLabel {
  readonly planName: string;
  readonly categoryName: string;
}

export interface PlannedItemOption {
  readonly item: PlannedItemDto;
  readonly planName: string;
  readonly categoryName: string;
}

export interface PlannedItemCatalogue {
  readonly options: ReadonlyArray<PlannedItemOption>;
  readonly labels: ReadonlyMap<string, PlannedItemLabel>;
}

/** Active plans with their items and category names; the pool a transaction can map to. */
export async function loadPlannedItems(
  plansApi: Pick<PlansApi, 'list' | 'listItems'>,
  categoryNames: () => Promise<ReadonlyMap<string, string>>,
): Promise<PlannedItemCatalogue> {
  const [plans, names] = await Promise.all([plansApi.list('active'), categoryNames()]);
  const perPlan = await Promise.all(plans.map((plan) => itemsOf(plansApi, plan)));
  const options = perPlan.flat().map(({ plan, item }) => ({
    item,
    planName: plan.name,
    categoryName: names.get(item.categoryId) ?? '',
  }));

  return {
    options,
    labels: new Map(
      options.map((o) => [o.item.id, { planName: o.planName, categoryName: o.categoryName }]),
    ),
  };
}

/** Puts the item the API suggests first, keeping the rest in order. */
export function suggestedFirst(
  options: ReadonlyArray<PlannedItemOption>,
  suggestedPlannedItemId: string | null,
): PlannedItemOption[] {
  return [...options].sort(
    (a, b) => rank(a, suggestedPlannedItemId) - rank(b, suggestedPlannedItemId),
  );
}

async function itemsOf(
  plansApi: Pick<PlansApi, 'listItems'>,
  plan: PlanDto,
): Promise<Array<{ plan: PlanDto; item: PlannedItemDto }>> {
  const items = await plansApi.listItems(plan.id);

  return items.map((item) => ({ plan, item }));
}

function rank(option: PlannedItemOption, suggestedPlannedItemId: string | null): number {
  return option.item.id === suggestedPlannedItemId ? 0 : 1;
}
