import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, PlannedItemId } from '@power-budget/core';
import type {
  PlannedItemProfile,
  PlannedItemQuery,
  ResolvedPlannedItem,
} from '../../domain/categorisation/entities.js';
import type { PlannedItemResolver } from '../../domain/categorisation/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzlePlannedItemResolver implements PlannedItemResolver {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async describe(
    plannedItemId: PlannedItemId,
    householdId: HouseholdId,
  ): Promise<PlannedItemProfile | null> {
    const rows = await this.db
      .select({ categoryId: schema.plannedItems.categoryId, planKind: schema.plans.type })
      .from(schema.plannedItems)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.plannedItems.planId))
      .where(
        and(
          eq(schema.plannedItems.id, plannedItemId),
          eq(schema.plannedItems.householdId, householdId),
          eq(schema.plans.householdId, householdId),
        ),
      )
      .limit(1);
    const row = rows[0];

    return row === undefined ? null : { categoryId: row.categoryId, planKind: row.planKind };
  }

  async resolveActive(query: PlannedItemQuery): Promise<ResolvedPlannedItem | null> {
    const items = schema.plannedItems;
    const plans = schema.plans;
    const rows = await this.db
      .select({ id: items.id })
      .from(items)
      .innerJoin(plans, eq(plans.id, items.planId))
      .where(
        and(
          eq(items.householdId, query.householdId),
          eq(plans.householdId, query.householdId),
          eq(items.categoryId, query.categoryId),
          eq(items.direction, query.direction),
          isNull(plans.archivedAt),
          lte(plans.periodStart, query.occurredOn),
          gte(plans.periodEnd, query.occurredOn),
          or(isNull(plans.ownerUserId), eq(plans.ownerUserId, query.ownerUserId)),
        ),
      )
      .orderBy(
        sql`coalesce(${plans.type} = ${query.planKindPref}, false) desc`,
        sql`coalesce(${plans.ownerUserId} = ${query.ownerUserId}, false) desc`,
        asc(plans.createdAt),
        asc(items.id),
      )
      .limit(1);
    const row = rows[0];

    return row === undefined ? null : { plannedItemId: row.id };
  }
}
