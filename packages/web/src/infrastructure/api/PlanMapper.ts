import type { components } from '@power-budget/shared-app/contract';

type Schemas = components['schemas'];

/** CLN-011 plan and planned-item contracts (generated api-types). */
export type PlanDto = Schemas['PlanDto'];
export type PlannedItemDto = Schemas['PlannedItemDto'];
export type CreatePlanDto = Schemas['CreatePlanDto'];
export type UpdatePlanDto = Schemas['UpdatePlanDto'];
export type ClonePlanDto = Schemas['ClonePlanDto'];
export type CreatePlannedItemDto = Schemas['CreatePlannedItemDto'];
export type UpdatePlannedItemDto = Schemas['UpdatePlannedItemDto'];

export type PlanStatus = 'active' | 'archived';

/** The plan as the plan screens use it. */
export interface PlanSummary {
  id: string;
  name: string;
  period: PlanDto['periodKind'];
  status: PlanStatus;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
}

/** A planned item as the plan screens use it: minor units stay an exact string. */
export interface PlannedItemSummary {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: PlannedItemDto['direction'];
  amountMinor: string;
  currency: string;
}

export const PlanMapper = {
  toPlan(dto: PlanDto): PlanSummary {
    return {
      id: dto.id,
      name: dto.name,
      period: dto.periodKind,
      status: dto.archivedAt === null ? 'active' : 'archived',
      baseCurrency: dto.baseCurrency,
      startDate: dto.period.start,
      endDate: dto.period.end,
      updatedAt: dto.updatedAt,
    };
  },

  toItem(dto: PlannedItemDto, categoryNames?: ReadonlyMap<string, string>): PlannedItemSummary {
    const categoryName = categoryNames?.get(dto.categoryId);

    return {
      id: dto.id,
      planId: dto.planId,
      categoryId: dto.categoryId,
      ...(categoryName === undefined ? {} : { categoryName }),
      direction: dto.direction,
      amountMinor: dto.amount.amountMinor,
      currency: dto.amount.currency,
    };
  },
};
