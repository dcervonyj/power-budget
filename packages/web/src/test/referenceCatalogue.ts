import type { PlansApi } from '@power-budget/shared-app';
import {
  ReferenceCatalogue,
  type CatalogueCategories,
} from '../application/catalogue/ReferenceCatalogue.js';

/** A catalogue over the given fakes; the dashboard never reads the list of active plans. */
export function catalogueFor(
  plans: Pick<PlansApi, 'get' | 'listItems'>,
  categories: CatalogueCategories,
): ReferenceCatalogue {
  return new ReferenceCatalogue({ ...plans, list: () => Promise.resolve([]) }, categories);
}
