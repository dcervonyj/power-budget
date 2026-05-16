import { Inject } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PlanId, HouseholdId, UserId, IsoDate, IsoDateTime } from '@power-budget/core';
import type { PlanRepository, HouseholdScope } from '../../domain/plans/ports.js';
import type { Plan, NewPlan } from '../../domain/plans/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

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
    if (!row) throw new Error('Failed to create plan');
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

  async listActive(query: {
    userId: UserId;
    householdId: HouseholdId;
    date: Date;
  }): Promise<Plan[]> {
    const dateStr = query.date.toISOString().slice(0, 10) as IsoDate;
    const rows = await this.db
      .select()
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.householdId, query.householdId),
          lte(schema.plans.periodStart, dateStr),
          gte(schema.plans.periodEnd, dateStr),
        ),
      );
    return rows.map((r) => this.toEntity(r));
  }

  async update(
    id: PlanId,
    patch: { readonly name?: string },
    scope: HouseholdScope,
  ): Promise<Plan> {
    const [row] = await this.db
      .update(schema.plans)
      .set({ ...(patch.name !== undefined ? { name: patch.name } : {}), updatedAt: new Date() })
      .where(and(eq(schema.plans.id, id), eq(schema.plans.householdId, scope.householdId)))
      .returning();
    if (!row) throw new Error(`Plan ${id} not found`);
    return this.toEntity(row);
  }

  async archive(id: PlanId, at: Date): Promise<void> {
    await this.db
      .update(schema.plans)
      .set({ archivedAt: at, updatedAt: at })
      .where(eq(schema.plans.id, id));
  }

  private toEntity(row: schema.SelectPlan): Plan {
    return {
      id: row.id as PlanId,
      householdId: row.householdId as HouseholdId,
      ownerUserId: row.ownerUserId as UserId | null,
      name: row.name,
      type: row.type as Plan['type'],
      periodKind: row.periodKind as Plan['periodKind'],
      period: {
        start: row.periodStart as IsoDate,
        end: row.periodEnd as IsoDate,
      },
      baseCurrency: row.baseCurrency,
      archivedAt: row.archivedAt ? (row.archivedAt.toISOString() as IsoDateTime) : null,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
      updatedAt: row.updatedAt.toISOString() as IsoDateTime,
    };
  }
}
