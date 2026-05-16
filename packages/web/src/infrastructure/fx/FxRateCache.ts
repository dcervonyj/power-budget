import type { ApiClient } from '@power-budget/shared-app';

export interface FxRateTable {
  baseCurrency: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

const CACHE_KEY = 'pb_fx_rates';
const TTL_MS = 60 * 60 * 1000;

export function getCachedRates(): FxRateTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxRateTable;
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchAndCacheRates(apiClient: ApiClient): Promise<FxRateTable | null> {
  const cached = getCachedRates();
  if (cached) return cached;
  try {
    const res = await apiClient.get<FxRateTable>('/fx-rates');
    const table: FxRateTable = { ...res.data, fetchedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(table));
    return table;
  } catch {
    return null;
  }
}
