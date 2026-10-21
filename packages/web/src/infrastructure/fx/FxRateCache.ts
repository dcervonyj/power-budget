import type { ApiClient, components } from '@power-budget/shared-app';

type FxRatesResponseDto = components['schemas']['FxRatesResponseDto'];

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
    const res = await apiClient.get<FxRatesResponseDto>('/fx-rates');
    const table = toRateTable(res.data, new Date().toISOString());
    localStorage.setItem(CACHE_KEY, JSON.stringify(table));
    return table;
  } catch {
    return null;
  }
}

/**
 * `GET /fx-rates` sends decimal strings (CLN-013). The table is only used for
 * approximate cross-currency display, so the rates become numbers here.
 */
export function toRateTable(dto: FxRatesResponseDto, fetchedAt: string): FxRateTable {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(dto.rates)) {
    const value = Number(rate);
    if (Number.isFinite(value) && value > 0) {
      rates[code] = value;
    }
  }

  return { baseCurrency: dto.baseCurrency, rates, fetchedAt };
}
