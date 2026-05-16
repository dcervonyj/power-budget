import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { TotpSecretRepository } from '../domain/ports.js';
import type { TotpSecret } from '../domain/entities.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleTotpSecretRepository implements TotpSecretRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findByUser(userId: UserId): Promise<TotpSecret | null> {
    const rows = await this.db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, userId));
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId as UserId,
      encryptedSecret: row.encryptedSecret,
      enrolledAt: row.enrolledAt,
      verifiedAt: row.verifiedAt ?? null,
    };
  }

  async save(secret: TotpSecret): Promise<void> {
    await this.db
      .insert(schema.totpSecrets)
      .values({
        userId: secret.userId,
        encryptedSecret: secret.encryptedSecret,
        enrolledAt: secret.enrolledAt,
        verifiedAt: secret.verifiedAt ?? null,
      })
      .onConflictDoUpdate({
        target: schema.totpSecrets.userId,
        set: {
          encryptedSecret: secret.encryptedSecret,
          verifiedAt: secret.verifiedAt ?? null,
        },
      });
  }

  async delete(userId: UserId): Promise<void> {
    await this.db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId));
  }
}
