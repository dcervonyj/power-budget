import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { LeftoverSnapshotId, PlanId, HouseholdId, IsoDateTime } from '@power-budget/core';
import type { LeftoverEntry } from '@power-budget/core';
import type { LeftoverSnapshotRepository } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleLeftoverSnapshotRepository implements LeftoverSnapshotRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async save(snapshot: {
    readonly id: LeftoverSnapshotId;
    readonly planId: PlanId;
    readonly householdId: HouseholdId;
    readonly closedAt: IsoDateTime;
    readonly entries: LeftoverEntry[];
  }): Promise<void> {
    const periodEnd = snapshot.closedAt.slice(0, 10);
    const totalAmountMinor = snapshot.entries.reduce(
      (sum, entry) => sum + entry.leftover.amountMinor,
      0n,
    );
    const currency = snapshot.entries[0]?.leftover.currency ?? 'USD';

    await this.db
      .insert(schema.leftoverSnapshots)
      .values({
        id: snapshot.id,
        householdId: snapshot.householdId,
        planId: snapshot.planId,
        periodEnd,
        amountMinor: totalAmountMinor,
        currency,
        computedAt: new Date(snapshot.closedAt),
      })
      .onConflictDoNothing();
  }
}
