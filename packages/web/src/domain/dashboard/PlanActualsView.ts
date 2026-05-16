export interface PlannedItemActual {
  id: string;
  category: string;
  direction: 'income' | 'expense';
  planned: number; // minor units
  actual: number; // minor units
  currency: string;
}

export interface PlanActualsView {
  planId: string;
  planName: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  currency: string;
  items: PlannedItemActual[];
  unplannedCount: number;
  unplannedTotal: number; // minor units
  totalIncomePlanned: number;
  totalIncomeActual: number;
  totalExpensePlanned: number;
  totalExpenseActual: number;
  leftover: number; // minor units (income actual - expense actual)
}
