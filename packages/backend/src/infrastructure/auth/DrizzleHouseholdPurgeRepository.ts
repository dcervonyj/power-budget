import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, lte, notInArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdPurgeRepository, HouseholdPurgeResult } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

/**
 * Coverage of every household-scoped table (CLN-076). A table is household-scoped when it has a
 * FK to households, or only reaches a household through another scoped table (sync_runs via
 * bank_connections). The guard test (DrizzleHouseholdPurgeRepository.spec.ts) fails when schema.ts
 * gains such a table that is in neither list. Add new tables here AND to deleteHouseholdData.
 */
export const HOUSEHOLD_PURGED_TABLES: readonly string[] = [
  'live_signals',
  'bank_fetch_ledger',
  'sync_runs',
  'transaction_mappings',
  'transfers',
  'transactions',
  'bank_accounts',
  'bank_connections',
  'planned_item_versions',
  'planned_items',
  'leftover_snapshots',
  'plans',
  'category_privacy',
  'categories',
  'household_exports',
  'notifications_outbox',
  'household_invites',
  'household_users',
  'households',
];

export const HOUSEHOLD_PURGE_EXEMPT_TABLES: Readonly<Record<string, string>> = {
  audit_log:
    'append-only; kept on purpose, FKs are ON DELETE SET NULL (migration 0015_cln-022) which anonymises the rows',
};

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * GDPR hard delete (CLN-022, docs/mvp/legal/DATA_DELETION_RUNBOOK.md). Runs in the worker only:
 * the worker's system DB scope bypasses RLS, so every statement filters by the household id
 * itself. Rows of audit_log are kept; their FKs are ON DELETE SET NULL (migration
 * 0015_cln-022), which anonymises them without an UPDATE grant on the append-only table.
 */
@Injectable()
export class DrizzleHouseholdPurgeRepository implements HouseholdPurgeRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async findDueHouseholdIds(
    now: Date,
    limit: number,
    excludeIds: readonly HouseholdId[],
  ): Promise<HouseholdId[]> {
    const rows = await this.db
      .select({ id: schema.households.id })
      .from(schema.households)
      .where(
        and(
          isNotNull(schema.households.deleteScheduledAt),
          lte(schema.households.deleteScheduledAt, now),
          excludeIds.length > 0 ? notInArray(schema.households.id, [...excludeIds]) : undefined,
        ),
      )
      .orderBy(asc(schema.households.deleteScheduledAt))
      .limit(limit);

    return rows.map((row) => row.id as HouseholdId);
  }

  async purge(householdId: HouseholdId, now: Date): Promise<HouseholdPurgeResult | null> {
    return this.db.transaction((tx) => this.purgeInTransaction(tx, householdId, now));
  }

  private async purgeInTransaction(
    tx: Transaction,
    householdId: HouseholdId,
    now: Date,
  ): Promise<HouseholdPurgeResult | null> {
    const due = await tx
      .select({ id: schema.households.id })
      .from(schema.households)
      .where(
        and(
          eq(schema.households.id, householdId),
          isNotNull(schema.households.deleteScheduledAt),
          lte(schema.households.deleteScheduledAt, now),
        ),
      )
      .for('update');
    if (due.length === 0) {
      return null;
    }

    const members = await tx
      .select({ userId: schema.householdUsers.userId })
      .from(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));

    await this.deleteHouseholdData(tx, householdId);
    await tx
      .delete(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));
    await tx.delete(schema.households).where(eq(schema.households.id, householdId));

    const deletedUserIds = await this.deleteOrphanedUsers(
      tx,
      members.map((member) => member.userId as UserId),
    );

    return { householdId, deletedUserIds };
  }

  /** Runbook order: children before parents so every FK holds at each statement. */
  private async deleteHouseholdData(tx: Transaction, householdId: HouseholdId): Promise<void> {
    const connectionIds = tx
      .select({ id: schema.bankConnections.id })
      .from(schema.bankConnections)
      .where(eq(schema.bankConnections.householdId, householdId));
    const transactionIds = tx
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.householdId, householdId));

    await tx.delete(schema.liveSignals).where(eq(schema.liveSignals.householdId, householdId));
    // FKs to sync_runs, bank_accounts and bank_connections: must go before all three.
    await tx
      .delete(schema.bankFetchLedger)
      .where(eq(schema.bankFetchLedger.householdId, householdId));
    await tx.delete(schema.syncRuns).where(inArray(schema.syncRuns.connectionId, connectionIds));
    await tx
      .delete(schema.transactionMappings)
      .where(inArray(schema.transactionMappings.transactionId, transactionIds));
    await tx.delete(schema.transfers).where(eq(schema.transfers.householdId, householdId));
    await tx.delete(schema.transactions).where(eq(schema.transactions.householdId, householdId));
    await tx.delete(schema.bankAccounts).where(eq(schema.bankAccounts.householdId, householdId));
    await tx
      .delete(schema.bankConnections)
      .where(eq(schema.bankConnections.householdId, householdId));
    await tx
      .delete(schema.plannedItemVersions)
      .where(eq(schema.plannedItemVersions.householdId, householdId));
    await tx.delete(schema.plannedItems).where(eq(schema.plannedItems.householdId, householdId));
    await tx
      .delete(schema.leftoverSnapshots)
      .where(eq(schema.leftoverSnapshots.householdId, householdId));
    await tx.delete(schema.plans).where(eq(schema.plans.householdId, householdId));
    await tx
      .delete(schema.categoryPrivacy)
      .where(eq(schema.categoryPrivacy.householdId, householdId));
    await tx.delete(schema.categories).where(eq(schema.categories.householdId, householdId));
    await tx
      .delete(schema.householdExports)
      .where(eq(schema.householdExports.householdId, householdId));
    await tx
      .delete(schema.notificationsOutbox)
      .where(eq(schema.notificationsOutbox.householdId, householdId));
    await tx
      .delete(schema.householdInvites)
      .where(eq(schema.householdInvites.householdId, householdId));
  }

  /** A former member with no other household loses the account and its credentials. */
  private async deleteOrphanedUsers(
    tx: Transaction,
    candidateIds: readonly UserId[],
  ): Promise<UserId[]> {
    if (candidateIds.length === 0) {
      return [];
    }
    const stillMembers = await tx
      .select({ userId: schema.householdUsers.userId })
      .from(schema.householdUsers)
      .where(inArray(schema.householdUsers.userId, [...candidateIds]));
    const kept = new Set(stillMembers.map((member) => member.userId));
    const orphanIds = candidateIds.filter((id) => !kept.has(id));
    if (orphanIds.length === 0) {
      return [];
    }

    await tx.delete(schema.sessions).where(inArray(schema.sessions.userId, orphanIds));
    await tx.delete(schema.authMethods).where(inArray(schema.authMethods.userId, orphanIds));
    await tx.delete(schema.totpSecrets).where(inArray(schema.totpSecrets.userId, orphanIds));
    await tx
      .delete(schema.magicLinkTokens)
      .where(inArray(schema.magicLinkTokens.userId, orphanIds));
    await tx
      .delete(schema.notificationsOutbox)
      .where(inArray(schema.notificationsOutbox.recipientUserId, orphanIds));
    await tx
      .update(schema.householdInvites)
      .set({ invitedByUserId: null })
      .where(inArray(schema.householdInvites.invitedByUserId, orphanIds));
    await tx
      .update(schema.householdInvites)
      .set({ acceptedByUserId: null })
      .where(inArray(schema.householdInvites.acceptedByUserId, orphanIds));
    await tx
      .update(schema.plans)
      .set({ ownerUserId: null })
      .where(inArray(schema.plans.ownerUserId, orphanIds));
    await tx.delete(schema.users).where(inArray(schema.users.id, orphanIds));

    return [...orphanIds];
  }
}
