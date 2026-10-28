import { Inject } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PlanId, HouseholdId, UserId, type IsoDate } from '@power-budget/core';
import type {
  PlanRepository,
  HouseholdScope,
  PlanListQuery,
  PlanPatch,
} from '../../domain/plans/ports.js';
import type { Plan, NewPlan, PlanType, PlanPeriodKind } from '../../domain/plans/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { isoDateOf, isoDateTimeOf, nullableIsoDateTimeOf, oneOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

const PLAN_TYPES: readonly PlanType[] = ['personal', 'household'];
const PERIOD_KINDS: readonly PlanPeriodKind[] = ['weekly', 'monthly', 'custom'];

export class DrizzlePlanRepository implements PlanRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(plan: NewPlan): Promise<Plan> {
    const [row] = await this.db
      .insert(schema.plans)
      .values({
        id: plan.id,
        householdId: plan.householdId,
        ownerUserId: plan.ownerUserId,
        name: plan.name,
        type: plan.type,
        periodKind: plan.periodKind,
        periodStart: plan.period.start,
        periodEnd: plan.period.end,
        baseCurrency: plan.baseCurrency,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create plan');
    }

    return this.toEntity(row);
  }

  async findById(id: PlanId, scope: HouseholdScope): Promise<Plan | null> {
    const rows = await this.db
      .select()
      .from(schema.plans)
      .where(and(eq(schema.plans.id, id), eq(schema.plans.householdId, scope.householdId)))
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  /**
   * Audit M13: honours archivedAt and the owner (a partner's personal plans are
   * not returned), and filters by period overlap instead of "today".
   */
  async list(query: PlanListQuery): Promise<Plan[]> {
    const conditions: SQL[] = [
      eq(schema.plans.householdId, query.householdId),
      this.visibleTo(query.viewerUserId),
    ];
    const status = this.statusCondition(query.status);
    if (status !== undefined) {
      conditions.push(status);
    }
    if (query.overlapping !== undefined) {
      conditions.push(lte(schema.plans.periodStart, query.overlapping.end));
      conditions.push(gte(schema.plans.periodEnd, query.overlapping.start));
    }

    const rows = await this.db
      .select()
      .from(schema.plans)
      .where(and(...conditions))
      .orderBy(asc(schema.plans.periodStart), asc(schema.plans.id));

    return rows.map((r) => this.toEntity(r));
  }

  async update(id: PlanId, patch: PlanPatch, scope: HouseholdScope): Promise<Plan> {
    const [row] = await this.db
      .update(schema.plans)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.baseCurrency !== undefined ? { baseCurrency: patch.baseCurrency } : {}),
        ...(patch.period !== undefined
          ? { periodStart: patch.period.start, periodEnd: patch.period.end }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.plans.id, id), eq(schema.plans.householdId, scope.householdId)))
      .returning();
    if (!row) {
      throw new Error(`PLAN_NOT_FOUND: Plan ${id} not found`);
    }

    return this.toEntity(row);
  }

  async archive(id: PlanId, at: Date, scope: HouseholdScope): Promise<void> {
    await this.db
      .update(schema.plans)
      .set({ archivedAt: at, updatedAt: at })
      .where(and(eq(schema.plans.id, id), eq(schema.plans.householdId, scope.householdId)));
  }

  async findDueForClose(day: IsoDate): Promise<Plan[]> {
    const snapshots = this.db
      .select({ one: sql`1` })
      .from(schema.leftoverSnapshots)
      .where(
        and(
          eq(schema.leftoverSnapshots.householdId, schema.plans.householdId),
          eq(schema.leftoverSnapshots.planId, schema.plans.id),
          eq(schema.leftoverSnapshots.periodEnd, schema.plans.periodEnd),
        ),
      );
    const rows = await this.db
      .select()
      .from(schema.plans)
      .where(
        and(lt(schema.plans.periodEnd, day), isNull(schema.plans.archivedAt), notExists(snapshots)),
      )
      .orderBy(asc(schema.plans.periodEnd), asc(schema.plans.id));

    return rows.map((r) => this.toEntity(r));
  }

  private visibleTo(userId: UserId): SQL {
    return (
      or(eq(schema.plans.type, 'household'), eq(schema.plans.ownerUserId, userId)) ??
      eq(schema.plans.type, 'household')
    );
  }

  private statusCondition(status: PlanListQuery['status']): SQL | undefined {
    switch (status) {
      case 'active':
        return isNull(schema.plans.archivedAt);
      case 'archived':
        return isNotNull(schema.plans.archivedAt);
      case 'all':
        return undefined;
    }
  }

  private toEntity(row: schema.SelectPlan): Plan {
    return {
      id: PlanId.of(row.id),
      householdId: HouseholdId.of(row.householdId),
      ownerUserId: row.ownerUserId === null ? null : UserId.of(row.ownerUserId),
      name: row.name,
      type: oneOf(PLAN_TYPES, row.type, 'plan type'),
      periodKind: oneOf(PERIOD_KINDS, row.periodKind, 'plan period kind'),
      period: {
        start: isoDateOf(row.periodStart),
        end: isoDateOf(row.periodEnd),
      },
      baseCurrency: row.baseCurrency,
      archivedAt: nullableIsoDateTimeOf(row.archivedAt),
      createdAt: isoDateTimeOf(row.createdAt),
      updatedAt: isoDateTimeOf(row.updatedAt),
    };
  }
}
