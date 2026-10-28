import type {
  AccountDto,
  BankConnectionDto,
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
  TransactionPageDto,
} from '@power-budget/shared-app/contract';
import { apiClient, categoriesApi, plansApi } from '../index.js';

/** Transactions read to count the ones to sort; above 99 the card shows "99+". */
export const TO_SORT_PAGE = 100;

/** What the Overview reads from the API (port; `httpOverviewApi` is the adapter). */
export interface OverviewApi {
  activePlans(): Promise<PlanDto[]>;
  plan(planId: string): Promise<PlanDto>;
  dashboard(planId: string): Promise<PlanDashboardResponseDto>;
  categories(): Promise<CategoryDto[]>;
  /** The first page of transactions to sort (unmapped). */
  toSortPage(): Promise<TransactionPageDto>;
  bankConnections(): Promise<BankConnectionDto[]>;
  accounts(): Promise<AccountDto[]>;
}

/** The Overview's reads over HTTP: the shared typed plan / category clients plus three plain GETs. */
export const httpOverviewApi: OverviewApi = {
  activePlans(): Promise<PlanDto[]> {
    return plansApi.list('active');
  },
  plan(planId: string): Promise<PlanDto> {
    return plansApi.get(planId);
  },
  dashboard(planId: string): Promise<PlanDashboardResponseDto> {
    return plansApi.dashboard(planId);
  },
  categories(): Promise<CategoryDto[]> {
    return categoriesApi.list({ includeArchived: true });
  },
  async toSortPage(): Promise<TransactionPageDto> {
    const response = await apiClient.get<TransactionPageDto>(
      `/transactions?unmappedOnly=true&limit=${String(TO_SORT_PAGE)}`,
    );

    return response.data;
  },
  async bankConnections(): Promise<BankConnectionDto[]> {
    const response = await apiClient.get<BankConnectionDto[]>('/bank-connections');

    return response.data;
  },
  async accounts(): Promise<AccountDto[]> {
    const response = await apiClient.get<AccountDto[]>('/accounts');

    return response.data;
  },
};
