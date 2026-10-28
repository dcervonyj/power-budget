import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HouseholdId, PlannedItemId, PlannedItemVersionId, UserId } from '@power-budget/core';
import type { HouseholdScope, PlannedItemVersionRepository } from '../../domain/plans/ports.js';
import type { NewPlannedItemVersion, PlannedItemVersion } from '../../domain/plans/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { isoDateTimeOf } from '../database/row-values.js';
import { plannedItemPatchFromJson, plannedItemPatchToJson } from './planned-item-version-json.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzlePlannedItemVersionRepository implements PlannedItemVersionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async append(version: NewPlannedItemVersion): Promise<void> {
    await this.db.insert(schema.plannedItemVersions).values({
      id: version.id,
      plannedItemId: version.plannedItemId,
      householdId: version.householdId,
      before: version.before === null ? null : plannedItemPatchToJson(version.before),
      after: plannedItemPatchToJson(version.after),
      changedBy: version.changedBy,
      reason: version.reason ?? null,
    });
  }

  /** Newest first. */
  async listByItem(itemId: PlannedItemId, scope: HouseholdScope): Promise<PlannedItemVersion[]> {
    const rows = await this.db
      .select()
      .from(schema.plannedItemVersions)
      .where(
        and(
          eq(schema.plannedItemVersions.plannedItemId, itemId),
          eq(schema.plannedItemVersions.householdId, scope.householdId),
        ),
      )
      .orderBy(desc(schema.plannedItemVersions.changedAt), desc(schema.plannedItemVersions.id));

    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: typeof schema.plannedItemVersions.$inferSelect): PlannedItemVersion {
    return {
      id: PlannedItemVersionId.of(row.id),
      plannedItemId: PlannedItemId.of(row.plannedItemId),
      householdId: HouseholdId.of(row.householdId),
      before: row.before === null ? null : plannedItemPatchFromJson(row.before),
      after: plannedItemPatchFromJson(row.after),
      changedBy: UserId.of(row.changedBy),
      changedAt: isoDateTimeOf(row.changedAt),
      reason: row.reason,
    };
  }
}
