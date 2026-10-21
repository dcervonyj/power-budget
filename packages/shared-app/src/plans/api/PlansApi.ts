import type { HttpClient } from '../../infrastructure/api-client/HttpClient.js';
import type {
  ClonePlanDto,
  CreatePlanDto,
  CreatePlannedItemDto,
  PlanDashboardResponseDto,
  PlanDto,
  PlannedItemDto,
  PlannedItemVersionDto,
  UnplannedTransactionPageDto,
  UpdatePlanDto,
  UpdatePlannedItemDto,
} from '../../contract/dto.js';

/** `GET /plans?status=`; the API lists active plans when no status is sent. */
export type PlanStatusFilter = 'active' | 'archived' | 'all';

/** Which side of the unplanned list: money spent or money received outside the plan. */
export type UnplannedDirection = 'income' | 'expense';

/** The plan endpoints (CLN-011), typed with the generated API contract. */
export class PlansApi {
  constructor(private readonly http: HttpClient) {}

  async list(status: PlanStatusFilter = 'active'): Promise<PlanDto[]> {
    const res = await this.http.get<PlanDto[]>(`/plans?status=${status}`);

    return res.data;
  }

  async get(planId: string): Promise<PlanDto> {
    const res = await this.http.get<PlanDto>(`/plans/${planId}`);

    return res.data;
  }

  async create(body: CreatePlanDto): Promise<PlanDto> {
    const res = await this.http.post<PlanDto>('/plans', body);

    return res.data;
  }

  async update(planId: string, body: UpdatePlanDto): Promise<PlanDto> {
    const res = await this.http.patch<PlanDto>(`/plans/${planId}`, body);

    return res.data;
  }

  async archive(planId: string): Promise<PlanDto> {
    const res = await this.http.post<PlanDto>(`/plans/${planId}/archive`, {});

    return res.data;
  }

  async clone(planId: string, body: ClonePlanDto): Promise<PlanDto> {
    const res = await this.http.post<PlanDto>(`/plans/${planId}/clone`, body);

    return res.data;
  }

  async listItems(planId: string): Promise<PlannedItemDto[]> {
    const res = await this.http.get<PlannedItemDto[]>(`/plans/${planId}/items`);

    return res.data;
  }

  async createItem(planId: string, body: CreatePlannedItemDto): Promise<PlannedItemDto> {
    const res = await this.http.post<PlannedItemDto>(`/plans/${planId}/items`, body);

    return res.data;
  }

  async updateItem(
    planId: string,
    itemId: string,
    body: UpdatePlannedItemDto,
  ): Promise<PlannedItemDto> {
    const res = await this.http.patch<PlannedItemDto>(`/plans/${planId}/items/${itemId}`, body);

    return res.data;
  }

  async deleteItem(planId: string, itemId: string): Promise<void> {
    await this.http.delete(`/plans/${planId}/items/${itemId}`);
  }

  /** Planned vs actual per item, unplanned totals and the net, in the plan's base currency. */
  async dashboard(planId: string): Promise<PlanDashboardResponseDto> {
    const res = await this.http.get<PlanDashboardResponseDto>(`/plans/${planId}/dashboard`);

    return res.data;
  }

  /** One page of the caller's own unplanned transactions (a partner's count in the totals only). */
  async unplanned(
    planId: string,
    direction: UnplannedDirection,
    cursor: string | null = null,
  ): Promise<UnplannedTransactionPageDto> {
    const query =
      cursor === null
        ? `direction=${direction}`
        : `direction=${direction}&cursor=${encodeURIComponent(cursor)}`;
    const res = await this.http.get<UnplannedTransactionPageDto>(
      `/plans/${planId}/dashboard/unplanned?${query}`,
    );

    return res.data;
  }

  async itemHistory(planId: string, itemId: string): Promise<PlannedItemVersionDto[]> {
    const res = await this.http.get<PlannedItemVersionDto[]>(
      `/plans/${planId}/items/${itemId}/history`,
    );

    return res.data;
  }
}

/** A plan is archived once `archivedAt` is set; there is no separate status field. */
export function isPlanArchived(plan: PlanDto): boolean {
  return plan.archivedAt !== null;
}
