import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  AccountIdentity,
  BankAccountIdentityRepository,
} from '../../domain/bank/fetch-ledger.js';
import type { BankAccountId, HouseholdId } from '../../domain/bank/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankAccountIdentityRepository implements BankAccountIdentityRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async setIdentity(
    accountId: BankAccountId,
    identity: AccountIdentity,
    householdId: HouseholdId,
  ): Promise<void> {
    const result = await this.db
      .update(schema.bankAccounts)
      .set({
        identificationHash: identity.identificationHash,
        providerAccountUid: identity.providerAccountUid,
      })
      .where(
        and(
          eq(schema.bankAccounts.id, accountId),
          eq(schema.bankAccounts.householdId, householdId),
        ),
      );
    if (result.rowCount === 0) {
      throw new Error(`Bank account ${accountId} not found in household ${householdId}`);
    }
  }

  async findByIdentificationHash(
    identificationHash: string,
    householdId: HouseholdId,
  ): Promise<BankAccountId | null> {
    const rows = await this.db
      .select({ id: schema.bankAccounts.id })
      .from(schema.bankAccounts)
      .where(
        and(
          eq(schema.bankAccounts.identificationHash, identificationHash),
          eq(schema.bankAccounts.householdId, householdId),
        ),
      );
    const id = rows[0]?.id;

    return id === undefined ? null : (id as BankAccountId);
  }
}
