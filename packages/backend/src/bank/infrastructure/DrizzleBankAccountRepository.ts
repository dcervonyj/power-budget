import { Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankConnectionId, HouseholdId, BankAccountId } from '@power-budget/core';
import type { BankAccount, RawBankAccount } from '../domain/entities.js';
import type { BankAccountRepository, HouseholdScope } from '../domain/ports.js';
import { uuidv7 } from 'uuidv7';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankAccountRepository implements BankAccountRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async upsertAll(
    accounts: RawBankAccount[],
    connectionId: BankConnectionId,
    scope: HouseholdScope,
  ): Promise<void> {
    if (accounts.length === 0) {
      return;
    }

    await this.db
      .insert(schema.bankAccounts)
      .values(
        accounts.map((a) => ({
          id: uuidv7() as BankAccountId,
          householdId: scope.householdId,
          connectionId,
          externalId: a.externalId,
          name: a.name,
          iban: a.iban,
          currency: a.currency,
          balanceMinor: a.balanceMinor,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.bankAccounts.connectionId, schema.bankAccounts.externalId],
        set: {
          name: sql`excluded.name`,
          iban: sql`excluded.iban`,
          balanceMinor: sql`excluded.balance_minor`,
          lastSyncedAt: new Date(),
        },
      });
  }

  async listByConnection(
    connectionId: BankConnectionId,
    scope: HouseholdScope,
  ): Promise<BankAccount[]> {
    const rows = await this.db
      .select()
      .from(schema.bankAccounts)
      .where(
        and(
          eq(schema.bankAccounts.connectionId, connectionId),
          eq(schema.bankAccounts.householdId, scope.householdId),
        ),
      );

    return rows.map((r) => ({
      id: r.id as BankAccountId,
      householdId: r.householdId as HouseholdId,
      connectionId: r.connectionId as BankConnectionId,
      externalId: r.externalId,
      name: r.name,
      iban: r.iban ?? null,
      currency: r.currency,
      balanceMinor: r.balanceMinor,
      lastSyncedAt: r.lastSyncedAt ?? null,
      createdAt: r.createdAt,
    }));
  }
}
