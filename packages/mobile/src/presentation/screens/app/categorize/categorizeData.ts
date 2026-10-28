import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
import { currentPlanOf } from '../../../../infrastructure/transactions/TransactionListModel.js';
import { choicesOf } from './categorizeModel.js';
import type { CategoryChoice } from './categorizeModel.js';

/** The planned items of today's plan with what is spent in them; empty when no plan covers today. */
export async function loadChoices(): Promise<CategoryChoice[]> {
  const plan = currentPlanOf(await plansApi.list('active'), todayIso());
  if (plan === undefined) {
    return [];
  }
  const [dashboard, categories] = await Promise.all([
    plansApi.dashboard(plan.id),
    categoriesApi.list({ includeArchived: true }),
  ]);

  return choicesOf(dashboard, new Map(categories.map((category) => [category.id, category.name])));
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}
