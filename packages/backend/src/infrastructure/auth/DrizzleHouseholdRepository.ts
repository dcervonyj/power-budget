import { Inject } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  Household,
  NewHousehold,
  HouseholdMember,
  HouseholdMembership,
} from '../../domain/auth/entities.js';
import type { HouseholdRepository } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { insertedRow } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleHouseholdRepository implements HouseholdRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: HouseholdId): Promise<Household | null> {
    const rows = await this.db.select().from(schema.households).where(eq(schema.households.id, id));

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async create(household: NewHousehold): Promise<Household> {
    const rows = await this.db
      .insert(schema.households)
      .values({
        id: household.id,
        name: household.name,
        baseCurrency: household.baseCurrency,
        createdAt: new Date(),
      })
      .returning();

    return this.toEntity(insertedRow(rows, 'household'));
  }

  async addMember(
    householdId: HouseholdId,
    userId: UserId,
    role: 'owner' | 'member',
  ): Promise<HouseholdMembership> {
    const now = new Date();
    await this.db
      .insert(schema.householdUsers)
      .values({ householdId, userId, role, joinedAt: now });

    return { householdId, userId, role, joinedAt: now };
  }

  async findMembership(
    householdId: HouseholdId,
    userId: UserId,
  ): Promise<HouseholdMembership | null> {
    const rows = await this.db
      .select()
      .from(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));
    const row = rows.find((r) => r.userId === userId);
    if (!row) {
      return null;
    }

    return {
      householdId: row.householdId,
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt,
    };
  }

  async findByUserId(userId: UserId): Promise<Household | null> {
    const rows = await this.db
      .select({ household: schema.households })
      .from(schema.householdUsers)
      .innerJoin(schema.households, eq(schema.householdUsers.householdId, schema.households.id))
      .where(eq(schema.householdUsers.userId, userId))
      .limit(1);

    return rows[0] ? this.toEntity(rows[0].household) : null;
  }

  async countMembers(householdId: HouseholdId): Promise<number> {
    const rows = await this.db
      .select({ members: count() })
      .from(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));

    return rows[0]?.members ?? 0;
  }

  async listMembers(householdId: HouseholdId): Promise<HouseholdMember[]> {
    const rows = await this.db
      .select({
        userId: schema.householdUsers.userId,
        role: schema.householdUsers.role,
        joinedAt: schema.householdUsers.joinedAt,
        email: schema.users.email,
        displayName: schema.users.displayName,
      })
      .from(schema.householdUsers)
      .innerJoin(schema.users, eq(schema.householdUsers.userId, schema.users.id))
      .where(eq(schema.householdUsers.householdId, householdId))
      .orderBy(asc(schema.householdUsers.joinedAt));

    return rows.map((row) => ({
      userId: row.userId,
      email: row.email,
      displayName: row.displayName,
      role: row.role === 'owner' ? 'owner' : 'member',
      joinedAt: row.joinedAt,
    }));
  }

  async scheduleDelete(id: HouseholdId, scheduledFor: Date): Promise<void> {
    await this.db
      .update(schema.households)
      .set({ deleteScheduledAt: scheduledFor })
      .where(eq(schema.households.id, id));
  }

  private toEntity(row: schema.SelectHousehold): Household {
    return {
      id: row.id,
      name: row.name,
      baseCurrency: row.baseCurrency,
      createdAt: row.createdAt,
    };
  }
}
