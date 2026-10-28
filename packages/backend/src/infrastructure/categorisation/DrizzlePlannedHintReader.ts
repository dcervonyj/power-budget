import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { CategoryId, IsoDate, PlannedItemId } from '@power-budget/core';
import type {
  HintedPlannedItem,
  HintedPlannedItemQuery,
} from '../../domain/categorisation/entities.js';
import type { PlannedHintReader } from '../../domain/categorisation/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { currencyOf } from '../database/row-values.js';
import { matchHintFromJson } from '../plans/match-hint-json.js';
import * as schema from '../../../drizzle/schema.js';

type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzlePlannedHintReader implements PlannedHintReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async listHinted(query: HintedPlannedItemQuery): Promise<HintedPlannedItem[]> {
    const items = schema.plannedItems;
    const plans = schema.plans;
    const rows = await this.db
      .select({
        id: items.id,
        categoryId: items.categoryId,
        direction: items.direction,
        amountMinor: items.amountMinor,
        currency: items.currency,
        matchHint: items.matchHint,
        periodStart: plans.periodStart,
        periodEnd: plans.periodEnd,
      })
      .from(items)
      .innerJoin(plans, eq(plans.id, items.planId))
      .where(
        and(
          eq(items.householdId, query.householdId),
          eq(plans.householdId, query.householdId),
          isNotNull(items.matchHint),
          isNull(plans.archivedAt),
          lte(plans.periodStart, query.to),
          gte(plans.periodEnd, query.from),
          or(isNull(plans.ownerUserId), eq(plans.ownerUserId, query.ownerUserId)),
        ),
      );

    return rows.flatMap((row) => this.toItem(row));
  }

  private toItem(row: {
    id: PlannedItemId;
    categoryId: CategoryId;
    direction: string;
    amountMinor: bigint;
    currency: string;
    matchHint: unknown;
    periodStart: IsoDate;
    periodEnd: IsoDate;
  }): HintedPlannedItem[] {
    const matchHint = matchHintFromJson(row.matchHint);
    if (matchHint === null || (row.direction !== 'income' && row.direction !== 'expense')) {
      return [];
    }

    return [
      {
        plannedItemId: row.id,
        categoryId: row.categoryId,
        direction: row.direction,
        amount: { amountMinor: row.amountMinor, currency: currencyOf(row.currency) },
        matchHint,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      },
    ];
  }
}
