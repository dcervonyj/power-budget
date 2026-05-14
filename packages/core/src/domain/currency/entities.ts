import type { FxRateId } from './ids.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

export type FxRateSource = 'ecb' | 'manual';

export interface FxRate {
  readonly id: FxRateId;
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  readonly rate: number;
  readonly rateDate: IsoDate;
  readonly source: FxRateSource;
  readonly fetchedAt: IsoDateTime;
}

/** Keyed as `${baseCurrency}/${quoteCurrency}`. */
export type FxRateTable = ReadonlyMap<string, FxRate>;
