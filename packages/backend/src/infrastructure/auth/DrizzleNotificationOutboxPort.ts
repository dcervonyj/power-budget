import { Inject, Logger } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { LocaleCode } from '../../domain/auth/entities.js';
import type { NotificationOutboxPort } from '../../domain/auth/ports.js';
import type { NotificationDispatchQueue } from '../../domain/notifications/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { BullMQNotificationDispatchQueue } from '../notifications/BullMQNotificationDispatchQueue.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleNotificationOutboxPort implements NotificationOutboxPort {
  private readonly logger = new Logger(DrizzleNotificationOutboxPort.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(BullMQNotificationDispatchQueue)
    private readonly dispatchQueue: NotificationDispatchQueue,
  ) {}

  async enqueue(event: {
    kind: string;
    userId: UserId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void> {
    const inserted = await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: uuidv7(),
        recipientUserId: event.userId,
        kind: event.kind,
        dedupeKey: event.dedupeKey,
        payload: event.payload,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: schema.notificationsOutbox.id });

    for (const row of inserted) {
      await this.scheduleNow(row.id);
    }
  }

  async enqueueToAddress(event: {
    kind: string;
    email: string;
    locale: LocaleCode;
    householdId: HouseholdId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void> {
    const inserted = await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: uuidv7(),
        householdId: event.householdId,
        recipientUserId: null,
        recipientEmail: event.email.toLowerCase(),
        recipientLocale: event.locale,
        kind: event.kind,
        dedupeKey: event.dedupeKey,
        payload: event.payload,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: schema.notificationsOutbox.id });

    for (const row of inserted) {
      await this.scheduleNow(row.id);
    }
  }

  /**
   * Sign-in and invite emails should not wait for the 5-minute relay cron. The row is
   * already committed, so a Redis failure here only delays the email until the
   * relay picks the row up.
   */
  private async scheduleNow(outboxId: string): Promise<void> {
    try {
      await this.dispatchQueue.schedule(outboxId);
    } catch (err) {
      this.logger.warn(
        `Dispatch of ${outboxId} left to the outbox relay: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
