import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryId, HouseholdId, UserId } from '@power-budget/core';
import type { CategoryPrivacyRepository, HouseholdScope } from '../../domain/categories/ports.js';
import type { CategoryPrivacy, CategoryPrivacyLevel } from '../../domain/categories/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { isoDateTimeOf, oneOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

const LEVELS: readonly CategoryPrivacyLevel[] = ['full_detail', 'total_with_counts', 'total_only'];

export class DrizzleCategoryPrivacyRepository implements CategoryPrivacyRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async listByHousehold(scope: HouseholdScope): Promise<CategoryPrivacy[]> {
    const rows = await this.db
      .select()
      .from(schema.categoryPrivacy)
      .where(eq(schema.categoryPrivacy.householdId, scope.householdId));

    return rows.map((row) => this.toEntity(row));
  }

  /** Callers only pass categories owned by the household (system ones are read-only). */
  async set(
    categoryId: CategoryId,
    level: CategoryPrivacyLevel,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .insert(schema.categoryPrivacy)
      .values({ categoryId, householdId: scope.householdId, level, updatedBy: by, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.categoryPrivacy.categoryId,
        set: { level, updatedBy: by, updatedAt: now },
        setWhere: eq(schema.categoryPrivacy.householdId, scope.householdId),
      });
  }

  private toEntity(row: typeof schema.categoryPrivacy.$inferSelect): CategoryPrivacy {
    return {
      categoryId: CategoryId.of(row.categoryId),
      householdId: HouseholdId.of(row.householdId),
      level: oneOf(LEVELS, row.level, 'category privacy level'),
      updatedBy: UserId.of(row.updatedBy),
      updatedAt: isoDateTimeOf(row.updatedAt),
    };
  }
}
