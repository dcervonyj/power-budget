import type { CurrencyCode } from '@power-budget/core';
import type { FxRate, FxRateRepository } from '../../../domain/fx/index.js';
import { FxRateUnavailableError } from '../errors.js';

const MAX_CARRY_FORWARD_DAYS = 7;
const ONE_DAY_MS = 86_400_000;

export class GetFxRateUseCase {
  constructor(private readonly repo: FxRateRepository) {}

  async execute(input: {
    base: CurrencyCode;
    quote: CurrencyCode;
    asOf: Date;
  }): Promise<FxRate> {
    const { base, quote, asOf } = input;

    for (let daysBack = 0; daysBack <= MAX_CARRY_FORWARD_DAYS; daysBack++) {
      const candidate = new Date(asOf.getTime() - daysBack * ONE_DAY_MS);
      const rate = await this.repo.getRate(base, quote, candidate);
      if (rate !== null) {
        return rate;
      }
    }

    const dateStr = asOf.toISOString().slice(0, 10);

    throw new FxRateUnavailableError(base, quote, dateStr);
  }
}
