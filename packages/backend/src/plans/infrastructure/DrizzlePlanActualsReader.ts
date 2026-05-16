import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  PlanId,
  PlanActualsView,
  IsoDate,
  PlannedItemId,
  CategoryId,
} from '@power-budget/core';
import { Money } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type { ProgressBand } from '@power-budget/core';
import type { PlanActualsReader } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

function progressBand(plannedMinor: bigint, actualMinor: bigint): ProgressBand {
  if (plannedMinor === 0n) return actualMinor > 0n ? 'over' : 'ok';
  if (actualMinor >= plannedMinor) return 'over';
  if (actualMinor * 100n >= plannedMinor * 80n) return 'warning';
  return 'ok';
}

export class DrizzlePlanActualsReader implements PlanActualsReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async read(planId: PlanId, asOf: Date): Promise<PlanActualsView> {
    const [planRows, viewResult] = await Promise.all([
      this.db.select().from(schema.plans).where(eq(schema.plans.id, planId)).limit(1),
      this.db.execute(sql`SELECT * FROM v_plan_actuals WHERE plan_id = ${planId}`),
    ]);

    const plan = planRows[0];
    if (!plan) {
      throw new Error(`PLAN_NOT_FOUND: Plan ${planId} not found`);
    }

    const base = plan.baseCurrency as CurrencyCode;
    const periodStart = plan.periodStart as IsoDate;
    const periodEnd = plan.periodEnd as IsoDate;

    const incomeLines: {
      plannedItemId: PlannedItemId;
      categoryId: CategoryId;
      direction: 'income';
      planned: Money;
      actual: Money;
      remaining: Money;
      progressBand: ProgressBand;
    }[] = [];

    const expenseLines: {
      plannedItemId: PlannedItemId;
      categoryId: CategoryId;
      direction: 'expense';
      planned: Money;
      actual: Money;
      remaining: Money;
      progressBand: ProgressBand;
    }[] = [];

    for (const row of viewResult.rows) {
      const plannedMinor = BigInt(String(row['planned_amount_minor']));
      const rawActualMinor = BigInt(String(row['actual_amount_minor']));
      // Take absolute value of actual to handle negative transaction amounts
      const actualMinor = rawActualMinor < 0n ? -rawActualMinor : rawActualMinor;
      const direction = row['direction'] as 'income' | 'expense';

      const planned = Money.of(plannedMinor, base);
      const actual = Money.of(actualMinor, base);
      const remaining = Money.of(plannedMinor - actualMinor, base);
      const band = progressBand(plannedMinor, actualMinor);

      if (direction === 'income') {
        incomeLines.push({
          plannedItemId: row['planned_item_id'] as PlannedItemId,
          categoryId: row['category_id'] as CategoryId,
          direction,
          planned,
          actual,
          remaining,
          progressBand: band,
        });
      } else {
        expenseLines.push({
          plannedItemId: row['planned_item_id'] as PlannedItemId,
          categoryId: row['category_id'] as CategoryId,
          direction,
          planned,
          actual,
          remaining,
          progressBand: band,
        });
      }
    }

    const totalPlannedIncome = Money.of(
      incomeLines.reduce((s, l) => s + l.planned.amountMinor, 0n),
      base,
    );
    const totalActualIncome = Money.of(
      incomeLines.reduce((s, l) => s + l.actual.amountMinor, 0n),
      base,
    );
    const totalPlannedExpenses = Money.of(
      expenseLines.reduce((s, l) => s + l.planned.amountMinor, 0n),
      base,
    );
    const totalActualExpenses = Money.of(
      expenseLines.reduce((s, l) => s + l.actual.amountMinor, 0n),
      base,
    );

    const unplannedResult = await this.db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN t.amount_minor > 0 THEN t.amount_minor ELSE 0 END), 0) AS unplanned_income_minor,
        COALESCE(SUM(CASE WHEN t.amount_minor < 0 THEN -t.amount_minor ELSE 0 END), 0) AS unplanned_expense_minor
      FROM transactions t
      WHERE t.household_id = ${plan.householdId}
        AND t.occurred_on BETWEEN ${periodStart} AND ${periodEnd}
        AND t.ignored = false
        AND NOT EXISTS (SELECT 1 FROM transaction_mappings tm WHERE tm.transaction_id = t.id)
        AND NOT EXISTS (
          SELECT 1 FROM transfers tf
          WHERE tf.tx_a_id = t.id OR tf.tx_b_id = t.id
        )
    `);

    const unplannedRow = unplannedResult.rows[0];
    const unplannedIncomeMinor = BigInt(String(unplannedRow?.['unplanned_income_minor'] ?? '0'));
    const unplannedExpenseMinor = BigInt(String(unplannedRow?.['unplanned_expense_minor'] ?? '0'));

    const net = Money.of(totalActualIncome.amountMinor - totalActualExpenses.amountMinor, base);
    const asOfStr = asOf.toISOString().slice(0, 10) as IsoDate;

    return {
      planId,
      period: { start: periodStart, end: periodEnd },
      baseCurrency: base,
      incomeLines,
      expenseLines,
      totalPlannedIncome,
      totalActualIncome,
      totalPlannedExpenses,
      totalActualExpenses,
      unplannedExpenses: Money.of(unplannedExpenseMinor, base),
      unplannedIncome: Money.of(unplannedIncomeMinor, base),
      net,
      asOf: asOfStr,
    };
  }
}
