import { Inject } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NewUserRegistration } from '../../domain/auth/entities.js';
import type { UserRegistrationRepository } from '../../domain/auth/ports.js';
import { EmailAlreadyRegisteredError } from '../../domain/auth/errors.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { uniqueViolationConstraint } from '../database/unique-violation.js';
import * as schema from '../../../drizzle/schema.js';

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** The unique index on lower(users.email). */
const USERS_EMAIL_UNIQUE = 'users_email_unique';

/**
 * Writes a registration all or nothing (CLN-033, audit BE-BUGS-12): before, the user, the
 * household and the membership were three statements, so a failure in between left a user
 * without a household, and a concurrent duplicate surfaced as a 500.
 */
export class DrizzleUserRegistrationRepository implements UserRegistrationRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async register(registration: NewUserRegistration): Promise<void> {
    try {
      await this.db.transaction(this.insertAll.bind(this, registration));
    } catch (error) {
      throw this.translate(error);
    }
  }

  private async insertAll(registration: NewUserRegistration, tx: Transaction): Promise<void> {
    const { user, household } = registration;
    const now = new Date();
    await tx.insert(schema.users).values({
      id: user.id,
      email: user.email.toLowerCase(),
      displayName: user.displayName,
      defaultLocale: user.defaultLocale,
      passwordHash: user.passwordHash ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(schema.households).values({
      id: household.id,
      name: household.name,
      baseCurrency: household.baseCurrency,
      createdAt: now,
    });
    await tx
      .insert(schema.householdUsers)
      .values({ householdId: household.id, userId: user.id, role: 'owner', joinedAt: now });
  }

  private translate(error: unknown): unknown {
    if (uniqueViolationConstraint(error) === USERS_EMAIL_UNIQUE) {
      return new EmailAlreadyRegisteredError();
    }

    return error;
  }
}
