import { Inject } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, UserId, HouseholdInviteId } from '@power-budget/core';
import type {
  AcceptInviteCommand,
  AcceptInviteOutcome,
  HouseholdInvite,
  NewHouseholdInvite,
} from '../../domain/auth/entities.js';
import type { HouseholdInviteRepository } from '../../domain/auth/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { runInDbScope } from '../database/DbScope.js';
import * as schema from '../../../drizzle/schema.js';

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type InviteRow = typeof schema.householdInvites.$inferSelect;

const invites = schema.householdInvites;

/**
 * household_invites, households and household_users are not under RLS (they are read
 * before a household is known, see migration 0008); every query here filters by the
 * household or token it was given.
 */
export class DrizzleHouseholdInviteRepository implements HouseholdInviteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async replaceOpen(invite: NewHouseholdInvite, at: Date): Promise<HouseholdInvite> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(invites)
        .set({ revokedAt: at })
        .where(and(eq(invites.householdId, invite.householdId), this.isOpen()));
      const rows = await tx
        .insert(invites)
        .values({
          id: invite.id,
          householdId: invite.householdId,
          email: invite.email.toLowerCase(),
          tokenHash: invite.tokenHash,
          expiresAt: invite.expiresAt,
          invitedByUserId: invite.invitedByUserId,
          createdAt: at,
        })
        .returning();

      return this.toEntity(this.single(rows));
    });
  }

  async findByTokenHash(tokenHash: string): Promise<HouseholdInvite | null> {
    const rows = await this.db.select().from(invites).where(eq(invites.tokenHash, tokenHash));

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findInHousehold(
    id: HouseholdInviteId,
    householdId: HouseholdId,
  ): Promise<HouseholdInvite | null> {
    const rows = await this.db
      .select()
      .from(invites)
      .where(and(eq(invites.id, id), eq(invites.householdId, householdId)));

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async listOpen(householdId: HouseholdId): Promise<HouseholdInvite[]> {
    const rows = await this.db
      .select()
      .from(invites)
      .where(and(eq(invites.householdId, householdId), this.isOpen()))
      .orderBy(desc(invites.createdAt));

    return rows.map((row) => this.toEntity(row));
  }

  async revoke(id: HouseholdInviteId, householdId: HouseholdId, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(invites)
      .set({ revokedAt: at })
      .where(and(eq(invites.id, id), eq(invites.householdId, householdId), this.isOpen()))
      .returning({ id: invites.id });

    return rows.length > 0;
  }

  async rotateToken(
    id: HouseholdInviteId,
    householdId: HouseholdId,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<HouseholdInvite | null> {
    const rows = await this.db
      .update(invites)
      .set({ tokenHash, expiresAt })
      .where(and(eq(invites.id, id), eq(invites.householdId, householdId), this.isOpen()))
      .returning();

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async acceptAndJoin(command: AcceptInviteCommand): Promise<AcceptInviteOutcome> {
    if (command.leaveHouseholdId === null) {
      return this.db.transaction((tx) => this.join(tx, command, null));
    }
    const leaving = command.leaveHouseholdId;

    // The data tables are under RLS: the emptiness check runs in the scope of the household
    // being left (the caller is its only member, checked again inside the transaction).
    return runInDbScope({ kind: 'household', householdId: leaving, userId: command.userId }, () =>
      this.db.transaction((tx) => this.join(tx, command, leaving)),
    );
  }

  /** Checks first, writes last: every early return leaves the database unchanged. */
  private async join(
    tx: Transaction,
    command: AcceptInviteCommand,
    leaving: HouseholdId | null,
  ): Promise<AcceptInviteOutcome> {
    // Row lock on the household serialises concurrent joins, so the capacity check holds.
    await tx
      .select({ id: schema.households.id })
      .from(schema.households)
      .where(eq(schema.households.id, command.householdId))
      .for('update');

    if ((await this.countMembers(tx, command.householdId)) >= command.maxMembers) {
      return 'household_full';
    }
    if (leaving !== null && !(await this.canLeave(tx, leaving, command.userId))) {
      return 'household_not_empty';
    }

    const claimed = await tx
      .update(invites)
      .set({ acceptedAt: command.at, acceptedByUserId: command.userId })
      .where(
        and(
          eq(invites.id, command.inviteId),
          eq(invites.householdId, command.householdId),
          this.isOpen(),
          gt(invites.expiresAt, command.at),
        ),
      )
      .returning({ id: invites.id });
    if (claimed.length === 0) {
      return 'invite_unavailable';
    }

    if (leaving !== null) {
      await this.leave(tx, leaving, command.userId, command.at);
    }
    await tx.insert(schema.householdUsers).values({
      householdId: command.householdId,
      userId: command.userId,
      role: 'member',
      joinedAt: command.at,
    });

    return 'joined';
  }

  /** The user is the only member and the household holds no plans, banks, transactions or categories. */
  private async canLeave(
    tx: Transaction,
    householdId: HouseholdId,
    userId: UserId,
  ): Promise<boolean> {
    const members = await tx
      .select({ userId: schema.householdUsers.userId })
      .from(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));
    if (members.length !== 1 || members[0]?.userId !== userId) {
      return false;
    }

    const result = await tx.execute<{ has_data: boolean }>(sql`
      SELECT (
        EXISTS (SELECT 1 FROM ${schema.plans} WHERE ${schema.plans.householdId} = ${householdId})
        OR EXISTS (SELECT 1 FROM ${schema.bankConnections} WHERE ${schema.bankConnections.householdId} = ${householdId})
        OR EXISTS (SELECT 1 FROM ${schema.bankAccounts} WHERE ${schema.bankAccounts.householdId} = ${householdId})
        OR EXISTS (SELECT 1 FROM ${schema.transactions} WHERE ${schema.transactions.householdId} = ${householdId})
        OR EXISTS (SELECT 1 FROM ${schema.categories} WHERE ${schema.categories.householdId} = ${householdId})
      ) AS has_data
    `);

    return result.rows[0]?.has_data === false;
  }

  /** Leaves the empty solo household: membership removed, open invites revoked, deletion due now. */
  private async leave(
    tx: Transaction,
    householdId: HouseholdId,
    userId: UserId,
    at: Date,
  ): Promise<void> {
    await tx
      .delete(schema.householdUsers)
      .where(
        and(
          eq(schema.householdUsers.householdId, householdId),
          eq(schema.householdUsers.userId, userId),
        ),
      );
    await tx
      .update(invites)
      .set({ revokedAt: at })
      .where(and(eq(invites.householdId, householdId), this.isOpen()));
    await tx
      .update(schema.households)
      .set({ deleteScheduledAt: at })
      .where(eq(schema.households.id, householdId));
  }

  private async countMembers(tx: Transaction, householdId: HouseholdId): Promise<number> {
    const rows = await tx
      .select({ members: count() })
      .from(schema.householdUsers)
      .where(eq(schema.householdUsers.householdId, householdId));

    return rows[0]?.members ?? 0;
  }

  private isOpen() {
    return and(isNull(invites.acceptedAt), isNull(invites.revokedAt));
  }

  private single(rows: InviteRow[]): InviteRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('household_invites insert returned no row');
    }

    return row;
  }

  private toEntity(row: InviteRow): HouseholdInvite {
    return {
      id: row.id,
      householdId: row.householdId,
      email: row.email,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      createdAt: row.createdAt,
      invitedByUserId: row.invitedByUserId,
      revokedAt: row.revokedAt,
    };
  }
}
