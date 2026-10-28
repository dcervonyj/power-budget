import { IsoDate, UnknownCurrencyPairError, isSupportedCurrency } from '@power-budget/core';
import type { CurrencyCode, FxRateTable } from '@power-budget/core';
import type { FxRateRepository } from '../../domain/fx/index.js';
import { FX_CARRY_FORWARD_DAYS } from '../../domain/fx/index.js';
import type { Plan } from '../../domain/plans/entities.js';
import { FxRateUnavailableError } from '../fx/errors.js';

export interface PlanFxRates {
  /** The day the rates are taken for: asOf, or the period end for a past plan. */
  readonly rateDate: IsoDate;
  readonly table: FxRateTable;
}

/** Converts a plan's money into its base currency with one rate snapshot. */
export class PlanFxRatesLoader {
  constructor(protected readonly fxRepo: FxRateRepository) {}

  async load(plan: Plan, asOf: Date): Promise<PlanFxRates> {
    const today = IsoDate.of(asOf.toISOString().slice(0, 10));
    const rateDate = today < plan.period.end ? today : plan.period.end;
    const table = await this.fetchTable(rateDate);

    return { rateDate, table };
  }

  /** A loader for one cron run: each rate date's table is fetched once, however many plans ask. */
  runScoped(): PlanFxRatesLoader {
    return new RunScopedPlanFxRatesLoader(this.fxRepo);
  }

  /** Throws UNSUPPORTED_CURRENCY when the stored base currency is not one the app knows. */
  baseCurrencyOf(plan: Plan): CurrencyCode {
    if (!isSupportedCurrency(plan.baseCurrency)) {
      throw new Error(
        `UNSUPPORTED_CURRENCY: Plan ${plan.id} has base currency ${plan.baseCurrency}`,
      );
    }

    return plan.baseCurrency;
  }

  /** A missing rate becomes FX_RATE_UNAVAILABLE (503) instead of an unmapped 500. */
  translateError(error: unknown, rates: PlanFxRates): unknown {
    if (error instanceof UnknownCurrencyPairError) {
      return new FxRateUnavailableError(error.from, error.to, rates.rateDate);
    }

    return error;
  }

  protected fetchTable(rateDate: IsoDate): Promise<FxRateTable> {
    return this.fxRepo.getTable(rateDate, FX_CARRY_FORWARD_DAYS);
  }
}

class RunScopedPlanFxRatesLoader extends PlanFxRatesLoader {
  private readonly tables = new Map<IsoDate, Promise<FxRateTable>>();

  protected override fetchTable(rateDate: IsoDate): Promise<FxRateTable> {
    const cached = this.tables.get(rateDate);
    if (cached !== undefined) {
      return cached;
    }
    const fetched = super.fetchTable(rateDate);
    this.tables.set(rateDate, fetched);

    return fetched;
  }
}
