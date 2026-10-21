import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NewLeftoverSnapshot, LeftoverSnapshotRepository } from '../../domain/plans/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleLeftoverSnapshotRepository implements LeftoverSnapshotRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async save(snapshot: NewLeftoverSnapshot): Promise<void> {
    await this.db
      .insert(schema.leftoverSnapshots)
      .values({
        id: snapshot.id,
        householdId: snapshot.householdId,
        planId: snapshot.planId,
        periodEnd: snapshot.periodEnd,
        amountMinor: snapshot.leftover.amountMinor,
        currency: snapshot.leftover.currency,
        computedAt: new Date(snapshot.closedAt),
      })
      .onConflictDoNothing();
  }
}
