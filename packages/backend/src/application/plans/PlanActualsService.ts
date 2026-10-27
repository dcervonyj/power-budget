import { IsoDate, computePlanActuals } from '@power-budget/core';
import type {
  CurrencyCode,
  PlanActualsView,
  PlannedItemId,
  Transaction,
  TransactionId,
} from '@power-budget/core';
import type { Plan, PlannedItem } from '../../domain/plans/entities.js';
import type {
  PlanActivity,
  PlanActivityReader,
  PlanActualsReader,
  PlannedItemRepository,
} from '../../domain/plans/ports.js';
import type { PlanFxRatesLoader } from './plan-fx-rates.js';

/**
 * The single implementation of the plan dashboard numbers: it loads the
 * period's activity and hands it to core `computePlanActuals` with an FX
 * table, so mixed currencies are converted instead of summed.
 */
export class PlanActualsService implements PlanActualsReader {
  constructor(
    private readonly itemRepo: PlannedItemRepository,
    private readonly activityReader: PlanActivityReader,
    private readonly fxRates: PlanFxRatesLoader,
  ) {}

  async read(plan: Plan, asOf: Date): Promise<PlanActualsView> {
    const baseCurrency = this.fxRates.baseCurrencyOf(plan);
    const scope = { householdId: plan.householdId };
    const [items, activity, rates] = await Promise.all([
      this.itemRepo.listByPlan(plan.id, scope),
      this.activityReader.read({ householdId: plan.householdId, period: plan.period }),
      this.fxRates.load(plan, asOf),
    ]);
    const asOfDate = IsoDate.of(asOf.toISOString().slice(0, 10));

    try {
      return computePlanActuals({
        plan: this.toCorePlan(plan, baseCurrency),
        plannedItems: items,
        transactions: this.transactionsOf(plan, activity, items),
        mappings: activity.mappings,
        transfers: activity.transfers,
        fxTable: rates.table,
        clock: () => asOfDate,
      });
    } catch (error) {
      throw this.fxRates.translateError(error, rates);
    }
  }

  /** A reader for one cron run: the FX table of each rate date is loaded once for all plans. */
  runScoped(): PlanActualsService {
    return new PlanActualsService(this.itemRepo, this.activityReader, this.fxRates.runScoped());
  }

  private toCorePlan(
    plan: Plan,
    baseCurrency: CurrencyCode,
  ): Parameters<typeof computePlanActuals>[0]['plan'] {
    return { id: plan.id, period: { kind: 'custom', range: plan.period }, baseCurrency };
  }

  /**
   * A household plan counts every member's transactions (totals only, no
   * descriptions leave this function). A personal plan counts its owner's
   * transactions, plus any transaction mapped to one of its items.
   */
  private transactionsOf(
    plan: Plan,
    activity: PlanActivity,
    items: readonly PlannedItem[],
  ): readonly Transaction[] {
    if (plan.type === 'household') {
      return activity.transactions;
    }
    const itemIds = new Set<PlannedItemId>(items.map((item) => item.id));
    const mappedHere = new Set<TransactionId>();
    for (const mapping of activity.mappings) {
      if (itemIds.has(mapping.plannedItemId)) {
        mappedHere.add(mapping.transactionId);
      }
    }

    return activity.transactions.filter(
      (tx) => activity.owners.get(tx.id) === plan.ownerUserId || mappedHere.has(tx.id),
    );
  }
}
