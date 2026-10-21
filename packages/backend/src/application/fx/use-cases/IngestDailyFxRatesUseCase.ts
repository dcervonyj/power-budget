import { FX_PIVOT_CURRENCY } from '@power-budget/core';
import type { CurrencyCode, IsoDate } from '@power-budget/core';
import type { FxRateProvider, FxRateRepository, NewFxRate } from '../../../domain/fx/index.js';
import { FX_REQUIRED_QUOTES } from '../../../domain/fx/index.js';

export interface FxIngestResult {
  readonly date: IsoDate;
  /** Rows inserted by this run. */
  readonly saved: number;
  /** True when every required currency was already stored for the date. */
  readonly alreadyComplete: boolean;
  /** Required currencies still missing after both providers (normal on weekends). */
  readonly missing: readonly CurrencyCode[];
  readonly warnings: readonly string[];
}

interface ProviderFetch {
  readonly rates: readonly NewFxRate[];
  readonly warnings: readonly string[];
}

/**
 * Stores the EUR reference rates for one date. ECB is the primary source;
 * the fallback (NBP table A) fills what ECB does not publish (UAH) or
 * everything when ECB is down. Idempotent per (date, currency): currencies
 * already stored for the date are neither refetched nor overwritten.
 */
export class IngestDailyFxRatesUseCase {
  constructor(
    private readonly primary: FxRateProvider,
    private readonly fallback: FxRateProvider,
    private readonly repo: FxRateRepository,
  ) {}

  async execute(date: IsoDate): Promise<FxIngestResult> {
    const existing = new Set(await this.repo.listQuoteCurrencies(FX_PIVOT_CURRENCY, date));
    if (FX_REQUIRED_QUOTES.every((quote) => existing.has(quote))) {
      return { date, saved: 0, alreadyComplete: true, missing: [], warnings: [] };
    }

    const primary = await this.fetchFrom(this.primary, 'primary', date);
    const fromPrimary = this.newRows(primary.rates, existing, date);
    const covered = new Set([...existing, ...fromPrimary.map((r) => r.quoteCurrency)]);
    const missingAfterPrimary = FX_REQUIRED_QUOTES.filter((quote) => !covered.has(quote));

    const fallback =
      missingAfterPrimary.length > 0
        ? await this.fetchFrom(this.fallback, 'fallback', date)
        : { rates: [], warnings: [] };
    const fromFallback = this.newRows(fallback.rates, covered, date);
    for (const row of fromFallback) {
      covered.add(row.quoteCurrency);
    }

    const saved = await this.repo.saveBatch([...fromPrimary, ...fromFallback]);

    return {
      date,
      saved,
      alreadyComplete: false,
      missing: FX_REQUIRED_QUOTES.filter((quote) => !covered.has(quote)),
      warnings: [...primary.warnings, ...fallback.warnings],
    };
  }

  private async fetchFrom(
    provider: FxRateProvider,
    role: string,
    date: IsoDate,
  ): Promise<ProviderFetch> {
    try {
      return { rates: await provider.fetchForDate(date), warnings: [] };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);

      return { rates: [], warnings: [`${role} FX provider failed for ${date}: ${reason}`] };
    }
  }

  /** Keeps EUR-based rows for exactly `date` whose quote is not stored yet (first row wins). */
  private newRows(
    rates: readonly NewFxRate[],
    alreadyStored: ReadonlySet<CurrencyCode>,
    date: IsoDate,
  ): NewFxRate[] {
    const seen = new Set<CurrencyCode>(alreadyStored);
    const rows: NewFxRate[] = [];
    for (const rate of rates) {
      if (rate.baseCurrency !== FX_PIVOT_CURRENCY || rate.rateDate !== date) {
        continue;
      }
      if (seen.has(rate.quoteCurrency)) {
        continue;
      }
      seen.add(rate.quoteCurrency);
      rows.push(rate);
    }

    return rows;
  }
}
