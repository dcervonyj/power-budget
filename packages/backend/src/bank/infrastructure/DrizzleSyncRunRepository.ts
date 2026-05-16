import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankConnectionId, SyncRunId } from '@power-budget/core';
import type { SyncRunRepository } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleSyncRunRepository implements SyncRunRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async start(connectionId: BankConnectionId): Promise<SyncRunId> {
    const id = randomUUID() as SyncRunId;
    await this.db.insert(schema.syncRuns).values({
      id,
      connectionId,
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  async finish(
    id: SyncRunId,
    result: { ok: boolean; fetched: number; error?: string },
  ): Promise<void> {
    await this.db
      .update(schema.syncRuns)
      .set({
        status: result.ok ? 'success' : 'failed',
        lastSuccessfulAt: result.ok ? new Date() : null,
        errorMessage: result.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, id));
  }

  async lastSuccessfulAt(connectionId: BankConnectionId): Promise<Date | null> {
    const rows = await this.db
      .select({ lastSuccessfulAt: schema.syncRuns.lastSuccessfulAt })
      .from(schema.syncRuns)
      .where(eq(schema.syncRuns.connectionId, connectionId))
      .orderBy(desc(schema.syncRuns.createdAt))
      .limit(1);
    return rows[0]?.lastSuccessfulAt ?? null;
  }
}
