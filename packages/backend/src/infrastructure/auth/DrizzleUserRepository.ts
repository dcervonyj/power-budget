import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { User, NewUser, LocaleCode } from '../../domain/auth/entities.js';
import type { UserRepository } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleUserRepository implements UserRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: UserId): Promise<User | null> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()));
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async create(user: NewUser): Promise<User> {
    const rows = await this.db
      .insert(schema.users)
      .values({
        id: user.id,
        email: user.email.toLowerCase(),
        displayName: user.displayName,
        defaultLocale: user.defaultLocale,
        passwordHash: user.passwordHash ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return this.toEntity(rows[0]!);
  }

  async updateLocalePreference(id: UserId, locale: LocaleCode): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ localePreference: locale, updatedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  private toEntity(row: schema.SelectUser): User {
    return {
      id: row.id as UserId,
      email: row.email,
      displayName: row.displayName,
      localePreference: (row.localePreference ?? null) as LocaleCode | null,
      defaultLocale: row.defaultLocale as LocaleCode,
      passwordHash: row.passwordHash ?? null,
      emailVerifiedAt: row.emailVerifiedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
