import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  MerchantCorrection,
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
          // A changed choice starts again at one confirmation, so its confidence is not
          // inherited from the category it replaces.
          hits: sql`CASE WHEN ${t.categoryId} = ${correction.categoryId} AND ${t.planKindPref} IS NOT DISTINCT FROM ${correction.planKindPref} THEN ${t.hits} + 1 ELSE 1 END`,
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
      householdId: row.householdId,
      ownerUserId: row.ownerUserId,
      matchKind: row.matchKind,
      pattern: row.pattern,
      categoryId: row.categoryId,
      planKindPref: row.planKindPref,
      alwaysAsk: row.alwaysAsk,
      hits: row.hits,
      lastHitAt: row.lastHitAt,
      createdFromTx: row.createdFromTx,
      createdBy: row.createdBy,
    };
  }
}
