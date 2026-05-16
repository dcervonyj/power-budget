import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { MagicLinkTokenRepository } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleMagicLinkTokenRepository implements MagicLinkTokenRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async save(token: { tokenHash: string; userId: UserId; expiresAt: Date }): Promise<void> {
    await this.db.insert(schema.magicLinkTokens).values({
      tokenHash: token.tokenHash,
      userId: token.userId,
      expiresAt: token.expiresAt,
      createdAt: new Date(),
    });
  }

  async consume(tokenHash: string): Promise<{ userId: UserId } | null> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(schema.magicLinkTokens)
      .where(eq(schema.magicLinkTokens.tokenHash, tokenHash));

    const row = rows[0];
    if (!row || row.expiresAt < now) return null;

    await this.db
      .delete(schema.magicLinkTokens)
      .where(eq(schema.magicLinkTokens.tokenHash, tokenHash));

    return { userId: row.userId as UserId };
  }
}
