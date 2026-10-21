import { Inject } from '@nestjs/common';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EncryptedString, UserId } from '@power-budget/core';
import type { TotpSecretRepository } from '../../domain/auth/ports.js';
import type { TotpSecret } from '../../domain/auth/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

type TotpSecretRow = typeof schema.totpSecrets.$inferSelect;

export class DrizzleTotpSecretRepository implements TotpSecretRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findByUser(userId: UserId): Promise<TotpSecret | null> {
    const rows = await this.db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, userId));
    const row = rows[0];
    if (!row) {
      return null;
    }

    return toEntity(row);
  }

  async save(secret: TotpSecret): Promise<void> {
    await this.db
      .insert(schema.totpSecrets)
      .values({
        userId: secret.userId,
        encryptedSecret: secret.encryptedSecret,
        enrolledAt: secret.enrolledAt,
        verifiedAt: secret.verifiedAt,
        lastUsedTimeStep: secret.lastUsedTimeStep,
      })
      .onConflictDoUpdate({
        target: schema.totpSecrets.userId,
        set: {
          encryptedSecret: secret.encryptedSecret,
          enrolledAt: secret.enrolledAt,
          verifiedAt: secret.verifiedAt,
          lastUsedTimeStep: secret.lastUsedTimeStep,
        },
      });
  }

  async claimTimeStep(userId: UserId, timeStep: number, verifiedAt: Date): Promise<boolean> {
    // One conditional UPDATE: Postgres row locking makes concurrent claims of
    // the same (or an older) step lose (audit M9).
    const rows = await this.db
      .update(schema.totpSecrets)
      .set({
        lastUsedTimeStep: timeStep,
        verifiedAt: sql`coalesce(${schema.totpSecrets.verifiedAt}, ${verifiedAt.toISOString()}::timestamptz)`,
      })
      .where(
        and(
          eq(schema.totpSecrets.userId, userId),
          or(
            isNull(schema.totpSecrets.lastUsedTimeStep),
            lt(schema.totpSecrets.lastUsedTimeStep, timeStep),
          ),
        ),
      )
      .returning({ userId: schema.totpSecrets.userId });

    return rows.length === 1;
  }

  async delete(userId: UserId): Promise<void> {
    await this.db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId));
  }
}

function toEntity(row: TotpSecretRow): TotpSecret {
  return {
    userId: row.userId as UserId,
    encryptedSecret: row.encryptedSecret as EncryptedString,
    enrolledAt: row.enrolledAt,
    verifiedAt: row.verifiedAt ?? null,
    lastUsedTimeStep: row.lastUsedTimeStep ?? null,
  };
}
