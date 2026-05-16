export class FxRateUnavailableError extends Error {
  constructor(base: string, quote: string, date: string) {
    super(`FX_RATE_UNAVAILABLE: ${base}/${quote} for ${date}`);
    this.name = 'FxRateUnavailableError';
  }
}
