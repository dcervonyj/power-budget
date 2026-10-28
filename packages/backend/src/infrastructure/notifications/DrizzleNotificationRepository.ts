import { NotificationEventId } from '@power-budget/core';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NotificationOutboxRow,
} from '../../domain/notifications/entities.js';
import type {
  ClaimedRecipient,
  NotificationClaim,
  NotificationRepository,
} from '../../domain/notifications/ports.js';
import { DrizzleNotificationClaim } from './DrizzleNotificationClaim.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

/** The expiring-connection select: `expiresAt` is nullable in the schema, the query only keeps rows that have one. */
interface ExpiringConnectionSource extends Omit<ExpiringConnectionRow, 'expiresAt' | 'locale'> {
  readonly expiresAt: Date | null;
  readonly localePreference: string | null;
  readonly defaultLocale: string;
}

@Injectable()
export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: string): Promise<NotificationOutboxRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.notificationsOutbox)
      .where(eq(schema.notificationsOutbox.id, NotificationEventId.of(id)))
      .limit(1);

    return row === undefined ? null : this.toEntity(row);
  }

  async findPendingBatch(limit: number): Promise<NotificationOutboxRow[]> {
    const rows = await this.db
      .select()
      .from(schema.notificationsOutbox)
      .where(this.isPending())
      .orderBy(schema.notificationsOutbox.createdAt)
      .limit(limit);

    return rows.map((r) => this.toEntity(r));
  }

  async claimForDispatch(id: string): Promise<NotificationClaim | null> {
    // The row lock only spans this short transaction (attempt count plus the
    // recipient read); the send runs after the commit and holds no connection.
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.notificationsOutbox)
        .set({ attempts: sql`${schema.notificationsOutbox.attempts} + 1` })
        .where(
          inArray(
            schema.notificationsOutbox.id,
            tx
              .select({ id: schema.notificationsOutbox.id })
              .from(schema.notificationsOutbox)
              .where(
                and(
                  eq(schema.notificationsOutbox.id, NotificationEventId.of(id)),
                  this.isPending(),
                ),
              )
              .for('update', { skipLocked: true }),
          ),
        )
        .returning();

      if (row === undefined) {
        return null;
      }
      const notification = this.toEntity(row);
      const recipient =
        notification.recipientUserId === null
          ? null
          : await this.readRecipient(tx, notification.recipientUserId);

      return new DrizzleNotificationClaim(this.db, notification, recipient);
    });
  }

  async listAllHouseholdMembers(): Promise<HouseholdMemberRow[]> {
    const rows = await this.db
      .select({
        householdId: schema.householdUsers.householdId,
        userId: schema.householdUsers.userId,
        email: schema.users.email,
        displayName: schema.users.displayName,
        defaultLocale: schema.users.defaultLocale,
        localePreference: schema.users.localePreference,
        emailBouncing: schema.users.emailBouncing,
      })
      .from(schema.householdUsers)
      .innerJoin(schema.users, eq(schema.householdUsers.userId, schema.users.id));

    return rows.map((r) => ({
      householdId: r.householdId,
      userId: r.userId,
      email: r.email,
      displayName: r.displayName,
      locale: r.localePreference ?? r.defaultLocale,
      emailBouncing: r.emailBouncing,
    }));
  }

  async findExpiringConnections(thresholdDate: Date): Promise<ExpiringConnectionRow[]> {
    const rows = await this.db
      .select({
        connectionId: schema.bankConnections.id,
        householdId: schema.bankConnections.householdId,
        userId: schema.bankConnections.userId,
        bankId: schema.bankConnections.bankId,
        expiresAt: schema.bankConnections.expiresAt,
        email: schema.users.email,
        displayName: schema.users.displayName,
        defaultLocale: schema.users.defaultLocale,
        localePreference: schema.users.localePreference,
        emailBouncing: schema.users.emailBouncing,
      })
      .from(schema.bankConnections)
      .innerJoin(schema.users, eq(schema.bankConnections.userId, schema.users.id))
      .where(
        and(
          eq(schema.bankConnections.status, 'active'),
          lte(schema.bankConnections.expiresAt, thresholdDate),
        ),
      );

    return rows.flatMap(this.toExpiringConnection, this);
  }

  async setEmailBouncing(email: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ emailBouncing: true })
      .where(eq(sql`lower(${schema.users.email})`, email.toLowerCase()));
  }

  async findUserById(userId: UserId): Promise<{
    email: string;
    displayName: string;
    locale: string;
    emailBouncing: boolean;
  } | null> {
    const rows = await this.db
      .select({
        email: schema.users.email,
        displayName: schema.users.displayName,
        defaultLocale: schema.users.defaultLocale,
        localePreference: schema.users.localePreference,
        emailBouncing: schema.users.emailBouncing,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (rows.length === 0 || !rows[0]) {
      return null;
    }
    const r = rows[0];

    return {
      email: r.email,
      displayName: r.displayName,
      locale: r.localePreference ?? r.defaultLocale,
      emailBouncing: r.emailBouncing,
    };
  }

  private async readRecipient(
    tx: Pick<NodePgDatabase<typeof schema>, 'select'>,
    userId: UserId,
  ): Promise<ClaimedRecipient | null> {
    const [user] = await tx
      .select({
        email: schema.users.email,
        defaultLocale: schema.users.defaultLocale,
        localePreference: schema.users.localePreference,
        emailBouncing: schema.users.emailBouncing,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (user === undefined) {
      return null;
    }

    return {
      email: user.email,
      locale: user.localePreference ?? user.defaultLocale,
      emailBouncing: user.emailBouncing,
    };
  }

  private toExpiringConnection(r: ExpiringConnectionSource): ExpiringConnectionRow[] {
    if (r.expiresAt === null) {
      return [];
    }

    return [
      {
        connectionId: r.connectionId,
        householdId: r.householdId,
        userId: r.userId,
        email: r.email,
        displayName: r.displayName,
        locale: r.localePreference ?? r.defaultLocale,
        bankId: r.bankId,
        expiresAt: r.expiresAt,
        emailBouncing: r.emailBouncing,
      },
    ];
  }

  private isPending(): SQL | undefined {
    return and(
      isNull(schema.notificationsOutbox.sentAt),
      isNull(schema.notificationsOutbox.failedAt),
    );
  }

  private toEntity(r: schema.SelectNotificationOutbox): NotificationOutboxRow {
    return {
      id: r.id,
      householdId: r.householdId,
      recipientUserId: r.recipientUserId,
      recipientEmail: r.recipientEmail,
      recipientLocale: r.recipientLocale,
      kind: r.kind,
      dedupeKey: r.dedupeKey,
      payload: r.payload,
      createdAt: r.createdAt,
      sentAt: r.sentAt,
      failedAt: r.failedAt,
      attempts: r.attempts,
    };
  }
}
