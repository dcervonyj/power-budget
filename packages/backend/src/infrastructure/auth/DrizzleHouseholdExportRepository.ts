import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, UserId, HouseholdExportId } from '@power-budget/core';
import type { HouseholdExport, HouseholdExportRepository } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleHouseholdExportRepository implements HouseholdExportRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(input: {
    id: HouseholdExportId;
    householdId: HouseholdId;
    requestedByUserId: UserId;
  }): Promise<HouseholdExport> {
    const [row] = await this.db
      .insert(schema.householdExports)
      .values({
        id: input.id,
        householdId: input.householdId,
        requestedByUserId: input.requestedByUserId,
        status: 'pending',
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('Failed to create export');
    return this.toEntity(row);
  }

  async updateStatus(
    id: HouseholdExportId,
    update: { status: 'processing' | 'ready' | 'failed'; downloadUrl?: string; expiresAt?: Date },
  ): Promise<void> {
    await this.db
      .update(schema.householdExports)
      .set({
        status: update.status,
        ...(update.downloadUrl !== undefined ? { downloadUrl: update.downloadUrl } : {}),
        ...(update.expiresAt !== undefined ? { expiresAt: update.expiresAt } : {}),
      })
      .where(eq(schema.householdExports.id, id));
  }

  async findById(id: HouseholdExportId): Promise<HouseholdExport | null> {
    const rows = await this.db
      .select()
      .from(schema.householdExports)
      .where(eq(schema.householdExports.id, id))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  private toEntity(row: schema.SelectHouseholdExport): HouseholdExport {
    return {
      id: row.id as HouseholdExportId,
      householdId: row.householdId as HouseholdId,
      requestedByUserId: row.requestedByUserId as UserId,
      status: row.status as HouseholdExport['status'],
      downloadUrl: row.downloadUrl ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
    };
  }
}
