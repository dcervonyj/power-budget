import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
import { choicesOf } from './categorizeModel.js';
import type { CategoryChoice } from './categorizeModel.js';

/** The planned items of every active plan with what is spent in them, like the detail picker offers. */
export async function loadChoices(): Promise<CategoryChoice[]> {
  const [plans, categories] = await Promise.all([
    plansApi.list('active'),
    categoriesApi.list({ includeArchived: true }),
  ]);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const perPlan = await Promise.all(
    plans.map(async (plan) => choicesOf(await plansApi.dashboard(plan.id), plan.name, names)),
  );

  return perPlan.flat();
}
