/**
 * Plan and planned-item wire shapes of the CLN-011 endpoints (PR #182). They are
 * declared here until the regenerated api-types land on master; then these
 * become `components['schemas']['PlanDto']` / `['PlannedItemDto']`.
 */
export interface PlanDto {
  id: string;
  name: string;
  type: 'personal' | 'household';
  ownerUserId: string | null;
  periodKind: 'weekly' | 'monthly' | 'custom';
  period: { start: string; end: string };
  baseCurrency: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedItemDto {
  id: string;
  planId: string;
  categoryId: string;
  direction: 'income' | 'expense';
  amount: { amountMinor: string; currency: string };
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

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
