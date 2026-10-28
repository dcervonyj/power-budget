import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { Account, ManualAccount, NewManualAccount } from '../../domain/bank/entities.js';
import type { AccountRepository, HouseholdScope } from '../../domain/bank/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { currencyOf } from '../database/row-values.js';
import * as schema from '../../../drizzle/schema.js';

/** Bank and manual accounts, always filtered to their owner (accounts are private). */
@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async listOwned(ownerUserId: UserId, scope: HouseholdScope): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(schema.bankAccounts)
      .where(
        and(
          eq(schema.bankAccounts.householdId, scope.householdId),
          eq(schema.bankAccounts.ownerUserId, ownerUserId),
        ),
      )
      .orderBy(asc(schema.bankAccounts.createdAt), asc(schema.bankAccounts.id));

    return rows.map((row) => this.toAccount(row));
  }

  async createManual(input: NewManualAccount, scope: HouseholdScope): Promise<ManualAccount> {
    const rows = await this.db
      .insert(schema.bankAccounts)
      .values({
        id: input.id,
        householdId: scope.householdId,
        kind: 'manual',
        ownerUserId: input.ownerUserId,
        connectionId: null,
        externalId: null,
        name: input.name,
        currency: input.currency,
      })
      .returning();

    return this.toManualAccount(rows[0]!);
  }

  private toAccount(row: schema.SelectBankAccount): Account {
    if (row.kind === 'bank' && row.connectionId !== null) {
      return {
        ...this.toManualAccount(row),
        kind: 'bank',
        connectionId: row.connectionId,
        balance: { amountMinor: row.balanceMinor, currency: currencyOf(row.currency) },
        lastSyncedAt: row.lastSyncedAt,
      };
    }

    return this.toManualAccount(row);
  }

  private toManualAccount(row: schema.SelectBankAccount): ManualAccount {
    return {
      id: row.id,
      householdId: row.householdId,
      ownerUserId: row.ownerUserId,
      kind: 'manual',
      name: row.name,
      currency: currencyOf(row.currency),
      createdAt: row.createdAt,
    };
  }
}
