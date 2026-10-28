import type { PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';
import type { ReferenceCatalogue } from '../catalogue/ReferenceCatalogue.js';

export type PlannedItemSource = Pick<ReferenceCatalogue, 'activePlans' | 'items' | 'categoryNames'>;

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
export async function loadPlannedItems(source: PlannedItemSource): Promise<PlannedItemCatalogue> {
  const [plans, names] = await Promise.all([source.activePlans(), source.categoryNames()]);
  const perPlan = await Promise.all(plans.map((plan) => itemsOf(source, plan)));
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
  source: Pick<PlannedItemSource, 'items'>,
  plan: PlanDto,
): Promise<Array<{ plan: PlanDto; item: PlannedItemDto }>> {
  const items = await source.items(plan.id);

  return items.map((item) => ({ plan, item }));
}

function rank(option: PlannedItemOption, suggestedPlannedItemId: string | null): number {
  return option.item.id === suggestedPlannedItemId ? 0 : 1;
}
