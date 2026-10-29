import { Inject } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HouseholdId, SUPPORTED_LOCALES, UserId } from '@power-budget/core';
import type { LocaleCode } from '../../domain/auth/entities.js';
import type {
  UserProfile,
  UserProfilePatch,
  UserProfileRepository,
} from '../../domain/auth/profile.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { currencyOf, oneOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

const LOCALES: readonly LocaleCode[] = SUPPORTED_LOCALES;

/** Profile and preferences of a user, with the household it belongs to (MVP: one). */
export class DrizzleUserProfileRepository implements UserProfileRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: UserId): Promise<UserProfile | null> {
    const rows = await this.db
      .select({
        user: schema.users,
        householdId: schema.households.id,
        householdBaseCurrency: schema.households.baseCurrency,
      })
      .from(schema.users)
      .leftJoin(schema.householdUsers, eq(schema.householdUsers.userId, schema.users.id))
      .leftJoin(schema.households, eq(schema.households.id, schema.householdUsers.householdId))
      .where(eq(schema.users.id, id))
      .orderBy(asc(schema.householdUsers.joinedAt))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }

    return {
      id: UserId.of(row.user.id),
      email: row.user.email,
      displayName: row.user.displayName,
      localePreference:
        row.user.localePreference === null
          ? null
          : oneOf(LOCALES, row.user.localePreference, 'locale'),
      defaultLocale: oneOf(LOCALES, row.user.defaultLocale, 'locale'),
      baseCurrency: row.user.baseCurrency === null ? null : currencyOf(row.user.baseCurrency),
      timezone: row.user.timezone,
      interestingCurrencies: row.user.interestingCurrencies,
      onboardingCompleted: row.user.onboardingCompletedAt !== null,
      householdId: row.householdId === null ? null : HouseholdId.of(row.householdId),
      householdBaseCurrency:
        row.householdBaseCurrency === null ? null : currencyOf(row.householdBaseCurrency),
    };
  }

  async update(id: UserId, patch: UserProfilePatch): Promise<void> {
    await this.db
      .update(schema.users)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.locale !== undefined ? { localePreference: patch.locale } : {}),
        ...(patch.baseCurrency !== undefined ? { baseCurrency: patch.baseCurrency } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(Array.isArray(patch.interestingCurrencies)
          ? { interestingCurrencies: [...patch.interestingCurrencies] }
          : {}),
        ...(typeof patch.onboardingCompleted === 'boolean'
          ? { onboardingCompletedAt: patch.onboardingCompleted ? new Date() : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id));
  }
}
