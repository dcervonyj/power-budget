import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import type { CategoryId, HouseholdId, PlanType, TransactionId, UserId } from '@power-budget/core';
import type {
  MerchantCorrection,
  MerchantMatchKind,
  MerchantRule,
  MerchantRuleKey,
} from '../../domain/categorisation/entities.js';
import type { MerchantRuleRepository } from '../../domain/categorisation/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleMerchantRuleRepository implements MerchantRuleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async recordCorrection(correction: MerchantCorrection): Promise<void> {
    if (correction.keys.length === 0) {
      return;
    }

    const t = schema.merchantRules;
    await this.db
      .insert(t)
      .values(
        correction.keys.map((key) => ({
          id: uuidv7(),
          householdId: correction.householdId,
          ownerUserId: correction.ownerUserId,
          matchKind: key.matchKind,
          pattern: key.pattern,
          categoryId: correction.categoryId,
          planKindPref: correction.planKindPref,
          alwaysAsk: correction.alwaysAsk,
          hits: 1,
          lastHitAt: correction.at,
          createdFromTx: correction.createdFromTx,
          createdBy: correction.by,
        })),
      )
      .onConflictDoUpdate({
        target: [t.householdId, t.ownerUserId, t.matchKind, t.pattern],
        set: {
          categoryId: correction.categoryId,
          planKindPref: correction.planKindPref,
          alwaysAsk: correction.alwaysAsk,
          hits: sql`${t.hits} + 1`,
          lastHitAt: correction.at,
          createdFromTx: correction.createdFromTx,
          updatedAt: correction.at,
        },
      });
  }

  async findMatching(
    keys: readonly MerchantRuleKey[],
    ownerUserId: UserId,
    householdId: HouseholdId,
  ): Promise<MerchantRule[]> {
    if (keys.length === 0) {
      return [];
    }

    const t = schema.merchantRules;
    const rows = await this.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.householdId, householdId),
          or(isNull(t.ownerUserId), eq(t.ownerUserId, ownerUserId)),
          inArray(
            t.pattern,
            keys.map((key) => key.pattern),
          ),
        ),
      );

    const rules = rows.map((row) => this.toRule(row));

    return keys.flatMap((key) => this.rulesOfKey(rules, key, ownerUserId));
  }

  /** The owner's own rule outranks an owner-less one for the same key. */
  private rulesOfKey(
    rules: readonly MerchantRule[],
    key: MerchantRuleKey,
    ownerUserId: UserId,
  ): MerchantRule[] {
    return rules
      .filter((rule) => rule.matchKind === key.matchKind && rule.pattern === key.pattern)
      .sort(
        (a, b) => Number(b.ownerUserId === ownerUserId) - Number(a.ownerUserId === ownerUserId),
      );
  }

  private toRule(row: schema.SelectMerchantRule): MerchantRule {
    return {
      id: row.id,
      householdId: row.householdId as HouseholdId,
      ownerUserId: row.ownerUserId as UserId | null,
      matchKind: row.matchKind as MerchantMatchKind,
      pattern: row.pattern,
      categoryId: row.categoryId as CategoryId,
      planKindPref: row.planKindPref as PlanType | null,
      alwaysAsk: row.alwaysAsk,
      hits: row.hits,
      lastHitAt: row.lastHitAt,
      createdFromTx: row.createdFromTx as TransactionId | null,
      createdBy: row.createdBy as UserId,
    };
  }
}
