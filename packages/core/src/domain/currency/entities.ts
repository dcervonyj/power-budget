import type { FxRateId } from './ids.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

/** ecb: ECB euro reference rates; nbp: NBP table A (UAH and ECB outages); manual: entered by hand. */
export type FxRateSource = 'ecb' | 'nbp' | 'manual';

export interface FxRate {
  readonly id: FxRateId;
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  /** Decimal string, never a float: `1 baseCurrency = rate quoteCurrency` (e.g. "4.2734"). */
  readonly rate: string;
  readonly rateDate: IsoDate;
  readonly source: FxRateSource;
  readonly fetchedAt: IsoDateTime;
}

/** Keyed as `${baseCurrency}/${quoteCurrency}`. */
export type FxRateTable = ReadonlyMap<string, FxRate>;
