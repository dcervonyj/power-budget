import type { ApiClient } from '@power-budget/shared-app';

export type PlanType = 'personal' | 'household';
export type PlanPeriodKind = 'weekly' | 'monthly' | 'custom';
export type PlannedDirection = 'income' | 'expense';

export interface PlanPeriod {
  readonly start: string;
  readonly end: string;
}

export interface Plan {
  readonly id: string;
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly baseCurrency: string;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlannedItem {
  readonly id: string;
  readonly planId: string;
  readonly categoryId: string;
  readonly direction: PlannedDirection;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePlanDto {
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly baseCurrency: string;
}

export interface UpdatePlanDto {
  readonly name?: string;
  readonly periodKind?: PlanPeriodKind;
  readonly period?: PlanPeriod;
  readonly baseCurrency?: string;
}

export interface CreatePlannedItemDto {
  readonly categoryId: string;
  readonly direction: PlannedDirection;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note?: string;
}

export interface UpdatePlannedItemDto {
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly note?: string | null;
}

export class PlanService {
  constructor(private readonly apiClient: ApiClient) {}

  async listPlans(): Promise<Plan[]> {
    const response = await this.apiClient.get<Plan[]>('/plans');
    return response.data;
  }

  async getPlan(planId: string): Promise<Plan> {
    const response = await this.apiClient.get<Plan>(`/plans/${planId}`);
    return response.data;
  }

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    const response = await this.apiClient.post<Plan>('/plans', dto);
    return response.data;
  }

  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<Plan> {
    const response = await this.apiClient.request<Plan>({
      url: `/plans/${planId}`,
      method: 'PATCH',
      body: dto,
    });
    return response.data;
  }

  async archivePlan(planId: string): Promise<void> {
    await this.apiClient.post(`/plans/${planId}/archive`, {});
  }

  async listPlannedItems(planId: string): Promise<PlannedItem[]> {
    const response = await this.apiClient.get<PlannedItem[]>(`/plans/${planId}/items`);
    return response.data;
  }

  async createPlannedItem(planId: string, dto: CreatePlannedItemDto): Promise<PlannedItem> {
    const response = await this.apiClient.post<PlannedItem>(`/plans/${planId}/items`, dto);
    return response.data;
  }

  async updatePlannedItem(
    planId: string,
    itemId: string,
    dto: UpdatePlannedItemDto,
  ): Promise<PlannedItem> {
    const response = await this.apiClient.request<PlannedItem>({
      url: `/plans/${planId}/items/${itemId}`,
      method: 'PATCH',
      body: dto,
    });
    return response.data;
  }

  async deletePlannedItem(planId: string, itemId: string): Promise<void> {
    await this.apiClient.delete(`/plans/${planId}/items/${itemId}`);
  }
}
