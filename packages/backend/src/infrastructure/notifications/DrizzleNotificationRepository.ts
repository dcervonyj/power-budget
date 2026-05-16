import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NewNotificationOutbox,
  NotificationOutbox,
  NotificationKind,
} from '../../domain/notifications/entities.js';
import type { NotificationRepository } from '../../domain/notifications/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async enqueue(notification: NewNotificationOutbox): Promise<void> {
    await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: notification.id,
        householdId: notification.householdId ?? null,
        recipientUserId: notification.recipientUserId,
        kind: notification.kind,
        dedupeKey: notification.dedupeKey,
        payload: notification.payload,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  async findPendingBatch(limit: number): Promise<NotificationOutbox[]> {
    const rows = await this.db
      .select()
      .from(schema.notificationsOutbox)
      .where(and(isNull(schema.notificationsOutbox.sentAt), isNull(schema.notificationsOutbox.failedAt)))
      .orderBy(schema.notificationsOutbox.createdAt)
      .limit(limit);

    return rows.map((r) => this.toEntity(r));
  }

  async markSent(id: string): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ sentAt: new Date() })
      .where(eq(schema.notificationsOutbox.id, id));
  }

  async markFailed(id: string): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ failedAt: new Date() })
      .where(eq(schema.notificationsOutbox.id, id));
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ attempts: sql`${schema.notificationsOutbox.attempts} + 1` })
      .where(eq(schema.notificationsOutbox.id, id));
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
      householdId: r.householdId as HouseholdId,
      userId: r.userId as UserId,
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

    return rows
      .filter((r) => r.expiresAt !== null)
      .map((r) => ({
        connectionId: r.connectionId,
        householdId: r.householdId as HouseholdId,
        userId: r.userId as UserId,
        email: r.email,
        displayName: r.displayName,
        locale: r.localePreference ?? r.defaultLocale,
        bankId: r.bankId,
        expiresAt: r.expiresAt as Date,
        emailBouncing: r.emailBouncing,
      }));
  }

  async setEmailBouncing(email: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ emailBouncing: true })
      .where(eq(sql`lower(${schema.users.email})`, email.toLowerCase()));
  }

  async findUserById(
    userId: UserId,
  ): Promise<{ email: string; displayName: string; locale: string; emailBouncing: boolean } | null> {
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

    if (rows.length === 0 || !rows[0]) return null;
    const r = rows[0];
    return {
      email: r.email,
      displayName: r.displayName,
      locale: r.localePreference ?? r.defaultLocale,
      emailBouncing: r.emailBouncing,
    };
  }

  private toEntity(r: schema.SelectNotificationOutbox): NotificationOutbox {
    return {
      id: r.id,
      householdId: (r.householdId as HouseholdId | null) ?? null,
      recipientUserId: r.recipientUserId as UserId,
      kind: r.kind as NotificationKind,
      dedupeKey: r.dedupeKey,
      payload: r.payload as Record<string, unknown>,
      createdAt: r.createdAt,
      sentAt: r.sentAt ?? null,
      failedAt: r.failedAt ?? null,
      attempts: r.attempts,
    };
  }
}
