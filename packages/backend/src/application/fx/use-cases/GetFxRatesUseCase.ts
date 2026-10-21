import { CURRENCIES, formatFxRatio, resolveFxRate } from '@power-budget/core';
import type { CurrencyCode, FxRateTable, IsoDate } from '@power-budget/core';
import type { FxRateRepository } from '../../../domain/fx/index.js';
import { FX_CARRY_FORWARD_DAYS, FX_RATE_FRACTION_DIGITS } from '../../../domain/fx/index.js';
import { FxRateUnavailableError } from '../errors.js';

export interface FxRatesSnapshot {
  readonly date: IsoDate;
  readonly baseCurrency: CurrencyCode;
  /** `1 baseCurrency = rates[quote] quote`, decimal strings. Unresolvable quotes are absent. */
  readonly rates: Readonly<Partial<Record<CurrencyCode, string>>>;
}

/**
 * Rates for one base currency as of a date: the latest stored rate per pair
 * within the carry-forward window, resolved through core `resolveFxRate`
 * (direct, inverse or EUR pivot) and formatted as decimal strings.
 */
export class GetFxRatesUseCase {
  constructor(private readonly repo: FxRateRepository) {}

  async execute(input: { date: IsoDate; baseCurrency: CurrencyCode }): Promise<FxRatesSnapshot> {
    const { date, baseCurrency } = input;
    const table = await this.repo.getTable(date, FX_CARRY_FORWARD_DAYS);
    const rates = this.ratesFor(baseCurrency, table);
    if (Object.keys(rates).length === 0) {
      throw new FxRateUnavailableError(baseCurrency, '*', date);
    }

    return { date, baseCurrency, rates };
  }

  private ratesFor(
    baseCurrency: CurrencyCode,
    table: FxRateTable,
  ): Partial<Record<CurrencyCode, string>> {
    const rates: Partial<Record<CurrencyCode, string>> = {};
    for (const { code: quote } of Object.values(CURRENCIES)) {
      if (quote === baseCurrency) {
        continue;
      }
      const ratio = resolveFxRate(baseCurrency, quote, table);
      if (ratio !== null) {
        rates[quote] = formatFxRatio(ratio, FX_RATE_FRACTION_DIGITS);
      }
    }

    return rates;
  }
}
