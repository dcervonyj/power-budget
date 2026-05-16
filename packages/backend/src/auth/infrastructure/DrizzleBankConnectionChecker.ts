import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { BankConnectionChecker } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankConnectionChecker implements BankConnectionChecker {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async hasActiveConnection(userId: UserId): Promise<boolean> {
    const rows = await this.db
      .select({ id: schema.bankConnections.id })
      .from(schema.bankConnections)
      .where(
        and(eq(schema.bankConnections.userId, userId), eq(schema.bankConnections.status, 'active')),
      )
      .limit(1);
    return rows.length > 0;
  }
}
