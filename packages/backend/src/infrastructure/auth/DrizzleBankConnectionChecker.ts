import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { BankConnectionChecker } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { runInDbScope } from '../database/DbScope.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankConnectionChecker implements BankConnectionChecker {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Runs during login, before the caller has a household scope, so RLS would hide the row.
   * The query filters by the user that just proved its password, hence the system scope.
   */
  async hasActiveConnection(userId: UserId): Promise<boolean> {
    return runInDbScope(
      { kind: 'system', reason: 'login-totp-policy' },
      this.queryActiveConnection.bind(this, userId),
    );
  }

  private async queryActiveConnection(userId: UserId): Promise<boolean> {
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
