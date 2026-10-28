import { Inject } from '@nestjs/common';
import { and, asc, eq, isNull, or, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryId, HouseholdId } from '@power-budget/core';
import type {
  CategoryListOptions,
  CategoryRepository,
  HouseholdScope,
} from '../../domain/categories/ports.js';
import type {
  Category,
  CategoryKind,
  CategoryPatch,
  NewCategory,
} from '../../domain/categories/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { isoDateTimeOf, nullableIsoDateTimeOf, oneOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

const KINDS: readonly CategoryKind[] = ['income', 'expense'];
const UNIQUE_VIOLATION = '23505';

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async list(scope: HouseholdScope, options: CategoryListOptions): Promise<Category[]> {
    const conditions: SQL[] = [this.visibleTo(scope)];
    if (!options.includeArchived) {
      conditions.push(isNull(schema.categories.archivedAt));
    }
    const rows = await this.db
      .select()
      .from(schema.categories)
      .where(and(...conditions))
      .orderBy(asc(schema.categories.kind), asc(schema.categories.name), asc(schema.categories.id));

    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: CategoryId, scope: HouseholdScope): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), this.visibleTo(scope)))
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async create(input: NewCategory): Promise<Category> {
    try {
      const [row] = await this.db
        .insert(schema.categories)
        .values({
          id: input.id,
          householdId: input.householdId,
          name: input.name,
          kind: input.kind,
          icon: input.icon,
          color: input.color,
        })
        .returning();
      if (!row) {
        throw new Error('Failed to create category');
      }

      return this.toEntity(row);
    } catch (error) {
      throw this.translate(error, input.name);
    }
  }

  async update(id: CategoryId, patch: CategoryPatch, scope: HouseholdScope): Promise<Category> {
    try {
      const [row] = await this.db
        .update(schema.categories)
        .set({
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
        })
        .where(this.ownedBy(id, scope))
        .returning();
      if (!row) {
        throw new Error(`CATEGORY_NOT_FOUND: Category ${id} not found`);
      }

      return this.toEntity(row);
    } catch (error) {
      throw this.translate(error, patch.name ?? '');
    }
  }

  async setArchivedAt(id: CategoryId, at: Date | null, scope: HouseholdScope): Promise<void> {
    try {
      await this.db
        .update(schema.categories)
        .set({ archivedAt: at })
        .where(this.ownedBy(id, scope));
    } catch (error) {
      throw this.translate(error, '');
    }
  }

  private visibleTo(scope: HouseholdScope): SQL {
    return (
      or(
        isNull(schema.categories.householdId),
        eq(schema.categories.householdId, scope.householdId),
      ) ?? eq(schema.categories.householdId, scope.householdId)
    );
  }

  private ownedBy(id: CategoryId, scope: HouseholdScope): SQL | undefined {
    return and(eq(schema.categories.id, id), eq(schema.categories.householdId, scope.householdId));
  }

  /** The partial unique index on (household_id, name) of active rows backs the use-case check. */
  private translate(error: unknown, name: string): unknown {
    const code = error !== null && typeof error === 'object' ? Reflect.get(error, 'code') : null;
    if (code === UNIQUE_VIOLATION) {
      return new Error(`CATEGORY_DUPLICATE: A category named "${name}" already exists`);
    }

    return error;
  }

  private toEntity(row: schema.SelectCategory): Category {
    return {
      id: CategoryId.of(row.id),
      householdId: row.householdId === null ? null : HouseholdId.of(row.householdId),
      seedKey: row.seedKey,
      name: row.name,
      icon: row.icon,
      color: row.color,
      kind: oneOf(KINDS, row.kind, 'category kind'),
      archivedAt: nullableIsoDateTimeOf(row.archivedAt),
      createdAt: isoDateTimeOf(row.createdAt),
    };
  }
}
