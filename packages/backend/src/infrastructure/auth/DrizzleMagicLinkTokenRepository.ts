import { Inject } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { MagicLinkTokenRepository } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
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

  async find(tokenHash: string): Promise<{ userId: UserId } | null> {
    const rows = await this.db
      .select({ userId: schema.magicLinkTokens.userId })
      .from(schema.magicLinkTokens)
      .where(this.liveToken(tokenHash));

    return toResult(rows[0]);
  }

  async consume(tokenHash: string): Promise<{ userId: UserId } | null> {
    // DELETE ... RETURNING: the row goes to exactly one caller (audit M9).
    const rows = await this.db
      .delete(schema.magicLinkTokens)
      .where(this.liveToken(tokenHash))
      .returning({ userId: schema.magicLinkTokens.userId });

    return toResult(rows[0]);
  }

  private liveToken(tokenHash: string) {
    return and(
      eq(schema.magicLinkTokens.tokenHash, tokenHash),
      gt(schema.magicLinkTokens.expiresAt, new Date()),
    );
  }
}

function toResult(row: { userId: UserId } | undefined): { userId: UserId } | null {
  if (row === undefined) {
    return null;
  }

  return { userId: row.userId };
}
