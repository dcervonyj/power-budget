import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId } from '@power-budget/core';
import type { HouseholdInvite } from '../domain/entities.js';
import type { HouseholdInviteRepository } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleHouseholdInviteRepository implements HouseholdInviteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(invite: Omit<HouseholdInvite, 'createdAt'>): Promise<HouseholdInvite> {
    const rows = await this.db
      .insert(schema.householdInvites)
      .values({
        id: invite.id,
        householdId: invite.householdId,
        email: invite.email.toLowerCase(),
        tokenHash: invite.tokenHash,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt ?? null,
        createdAt: new Date(),
      })
      .returning();
    return this.toEntity(rows[0]!);
  }

  async findByTokenHash(tokenHash: string): Promise<HouseholdInvite | null> {
    const rows = await this.db
      .select()
      .from(schema.householdInvites)
      .where(eq(schema.householdInvites.tokenHash, tokenHash));
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async accept(id: string, at: Date): Promise<void> {
    await this.db
      .update(schema.householdInvites)
      .set({ acceptedAt: at })
      .where(eq(schema.householdInvites.id, id));
  }

  private toEntity(row: typeof schema.householdInvites.$inferSelect): HouseholdInvite {
    return {
      id: row.id,
      householdId: row.householdId as HouseholdId,
      email: row.email,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt ?? null,
      createdAt: row.createdAt,
    };
  }
}
