import { categoriesApi, plansApi } from '../../AppProviders.js';
import { clientSession } from '../auth/ClientSession.js';
import { ReferenceCatalogue, type CataloguePlans } from './ReferenceCatalogue.js';

/** Reads the providers when a call is made, not when this module loads (no cycle at start-up). */
const lazyPlans: CataloguePlans = {
  list: (status) => plansApi.list(status),
  get: (planId) => plansApi.get(planId),
  listItems: (planId) => plansApi.listItems(planId),
};

/** The app's catalogue; sign-out clears it with the other session stores. */
export const referenceCatalogue = new ReferenceCatalogue(lazyPlans, {
  list: (query) => categoriesApi.list(query),
});
clientSession.register(referenceCatalogue);
