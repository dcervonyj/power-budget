import type { IsoDate } from '../shared/ids.js';
import type { DateRange } from '../shared/date-range.js';

export type PlanPeriod =
  | { readonly kind: 'weekly'; readonly startDate: IsoDate }
  | { readonly kind: 'monthly'; readonly year: number; readonly month: number }
  | { readonly kind: 'custom'; readonly range: DateRange };
