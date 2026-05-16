import { Inject } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  CategoryId,
  CategoryPrivacyLevel,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  TransactionId,
  UserId,
  BankAccountId,
  CurrencyCode,
  CategoryAggregate,
} from '@power-budget/core';
import type { Category as CoreCategory } from '@power-budget/core';
import type { Transaction as CoreTransaction } from '@power-budget/core';
import { aggregateByCategoryWithPrivacy } from '@power-budget/core';
import type {
  HouseholdDashboardReader,
  HouseholdDashboardData,
} from '../../domain/plans/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleHouseholdDashboardReader implements HouseholdDashboardReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async read(params: {
    readonly householdId: HouseholdId;
    readonly planId: PlanId;
    readonly periodStart: IsoDate;
    readonly periodEnd: IsoDate;
    readonly viewerUserId: UserId;
  }): Promise<HouseholdDashboardData> {
    const { householdId, planId, periodStart, periodEnd, viewerUserId } = params;

    // 1. Fetch all categories for the household (including system/seed categories)
    const categoryRows = await this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.householdId, householdId));

    // 2. Fetch privacy settings for this household
    const privacyRows = await this.db
      .select()
      .from(schema.categoryPrivacy)
      .where(eq(schema.categoryPrivacy.householdId, householdId));

    // 3. Fetch transactions for the plan period
    const txRows = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.householdId, householdId),
          gte(schema.transactions.occurredOn, periodStart),
          lte(schema.transactions.occurredOn, periodEnd),
        ),
      );

    // 4. Build txCategoryMap: transactionId → categoryId
    //    Path: transactionMappings.transactionId → plannedItems.categoryId (filtered by planId)
    const mappingRows = await this.db
      .select({
        transactionId: schema.transactionMappings.transactionId,
        categoryId: schema.plannedItems.categoryId,
      })
      .from(schema.transactionMappings)
      .innerJoin(
        schema.plannedItems,
        eq(schema.transactionMappings.plannedItemId, schema.plannedItems.id),
      )
      .innerJoin(
        schema.transactions,
        eq(schema.transactionMappings.transactionId, schema.transactions.id),
      )
      .where(
        and(
          eq(schema.plannedItems.planId, planId),
          eq(schema.transactions.householdId, householdId),
          gte(schema.transactions.occurredOn, periodStart),
          lte(schema.transactions.occurredOn, periodEnd),
        ),
      );

    // 5. Convert to core types

    const categories: CoreCategory[] = categoryRows.map((row) => ({
      id: row.id as CategoryId,
      householdId: (row.householdId ?? null) as HouseholdId | null,
      name: row.name,
      kind: row.kind as CoreCategory['kind'],
      sortOrder: 0,
      isSystem: row.seedKey !== null,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
    }));

    const privacyMap = new Map<CategoryId, CategoryPrivacyLevel>(
      privacyRows.map((row) => [
        row.categoryId as CategoryId,
        row.level as CategoryPrivacyLevel,
      ]),
    );

    const txCategoryMap = new Map<TransactionId, CategoryId>(
      mappingRows.map((row) => [
        row.transactionId as TransactionId,
        row.categoryId as CategoryId,
      ]),
    );

    const transactions: CoreTransaction[] = txRows.map((row) => ({
      id: row.id as TransactionId,
      householdId: row.householdId as HouseholdId,
      accountId: row.accountId as BankAccountId,
      externalId: row.externalId ?? null,
      source: 'bank',
      status: 'posted',
      amount: {
        amountMinor: row.amountMinor,
        currency: row.currency as CurrencyCode,
      },
      description: row.description,
      merchantName: row.merchant ?? null,
      bookedAt: row.occurredOn as IsoDate,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
    }));

    // 6. Call core pure function
    const aggregates: CategoryAggregate[] = aggregateByCategoryWithPrivacy({
      transactions,
      txCategoryMap,
      categories,
      viewerUserId,
      privacyMap,
    });

    return { categories: aggregates };
  }
}
