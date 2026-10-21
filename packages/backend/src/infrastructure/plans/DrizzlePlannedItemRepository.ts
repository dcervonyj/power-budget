import { Inject } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import { CategoryId, HouseholdId, PlanId, PlannedItemId } from '@power-budget/core';
import type { UserId } from '@power-budget/core';
import type { HouseholdScope, PlannedItemRepository } from '../../domain/plans/ports.js';
import type {
  NewPlannedItem,
  PlannedDirection,
  PlannedItem,
  PlannedItemPatch,
} from '../../domain/plans/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { currencyOf, isoDateTimeOf, oneOf } from '../database/row-values.js';
import { plannedItemPatchToJson } from './planned-item-version-json.js';
import * as schema from '../../../drizzle/schema.js';

const DIRECTIONS: readonly PlannedDirection[] = ['income', 'expense'];

export class DrizzlePlannedItemRepository implements PlannedItemRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async add(item: NewPlannedItem): Promise<PlannedItem> {
    const [row] = await this.db
      .insert(schema.plannedItems)
      .values({
        id: item.id,
        planId: item.planId,
        householdId: item.householdId,
        categoryId: item.categoryId,
        direction: item.direction,
        amountMinor: item.amount.amountMinor,
        currency: item.amount.currency,
        note: item.note ?? null,
      })
      .returning();
    if (!row) throw new Error('Failed to add planned item');
    return this.toEntity(row);
  }

  async findById(id: PlannedItemId, scope: HouseholdScope): Promise<PlannedItem | null> {
    const rows = await this.db
      .select()
      .from(schema.plannedItems)
      .where(this.byId(id, scope))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async update(
    id: PlannedItemId,
    patch: PlannedItemPatch,
    changedBy: UserId,
    scope: HouseholdScope,
    reason?: string,
  ): Promise<PlannedItem> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.plannedItems)
        .where(this.byId(id, scope))
        .for('update');
      if (!before) {
        throw new Error(`PLANNED_ITEM_NOT_FOUND: Planned item ${id} not found`);
      }

      const [row] = await tx
        .update(schema.plannedItems)
        .set({
          ...(patch.amount !== undefined
            ? { amountMinor: patch.amount.amountMinor, currency: patch.amount.currency }
            : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          updatedAt: new Date(),
        })
        .where(this.byId(id, scope))
        .returning();
      if (!row) {
        throw new Error(`PLANNED_ITEM_NOT_FOUND: Planned item ${id} not found`);
      }

      const previous = this.toEntity(before);
      await tx.insert(schema.plannedItemVersions).values({
        id: uuidv7(),
        plannedItemId: id,
        householdId: scope.householdId,
        before: plannedItemPatchToJson({ amount: previous.amount, note: previous.note }),
        after: plannedItemPatchToJson(patch),
        changedBy,
        reason: reason ?? null,
      });

      return this.toEntity(row);
    });
  }

  async remove(id: PlannedItemId, scope: HouseholdScope): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({ id: schema.plannedItems.id })
        .from(schema.plannedItems)
        .where(this.byId(id, scope));
      if (!item) {
        return;
      }
      // Mapped transactions become unplanned; the item's history goes with it.
      await tx
        .delete(schema.transactionMappings)
        .where(eq(schema.transactionMappings.plannedItemId, item.id));
      await tx
        .delete(schema.plannedItemVersions)
        .where(
          and(
            eq(schema.plannedItemVersions.plannedItemId, item.id),
            eq(schema.plannedItemVersions.householdId, scope.householdId),
          ),
        );
      await tx.delete(schema.plannedItems).where(this.byId(id, scope));
    });
  }

  async listByPlan(planId: PlanId, scope: HouseholdScope): Promise<PlannedItem[]> {
    const rows = await this.db
      .select()
      .from(schema.plannedItems)
      .where(
        and(
          eq(schema.plannedItems.planId, planId),
          eq(schema.plannedItems.householdId, scope.householdId),
        ),
      )
      .orderBy(asc(schema.plannedItems.createdAt), asc(schema.plannedItems.id));
    return rows.map((r) => this.toEntity(r));
  }

  private byId(id: PlannedItemId, scope: HouseholdScope) {
    return and(
      eq(schema.plannedItems.id, id),
      eq(schema.plannedItems.householdId, scope.householdId),
    );
  }

  private toEntity(row: schema.SelectPlannedItem): PlannedItem {
    return {
      id: PlannedItemId.of(row.id),
      planId: PlanId.of(row.planId),
      householdId: HouseholdId.of(row.householdId),
      categoryId: CategoryId.of(row.categoryId),
      direction: oneOf(DIRECTIONS, row.direction, 'planned item direction'),
      amount: { amountMinor: row.amountMinor, currency: currencyOf(row.currency) },
      note: row.note,
      createdAt: isoDateTimeOf(row.createdAt),
      updatedAt: isoDateTimeOf(row.updatedAt),
    };
  }
}
