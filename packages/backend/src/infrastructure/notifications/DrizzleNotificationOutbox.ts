import { NotificationEventId } from '@power-budget/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  NewAddressNotification,
  NewNotificationOutbox,
} from '../../domain/notifications/entities.js';
import type {
  NotificationDispatchQueue,
  NotificationOutbox,
} from '../../domain/notifications/ports.js';
import type { Clock, IdGenerator } from '../../domain/shared/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import { CLOCK, ID_GENERATOR } from '../system/SystemModule.js';
import { BullMQNotificationDispatchQueue } from './BullMQNotificationDispatchQueue.js';
import * as schema from '../../../drizzle/schema.js';

@Injectable()
export class DrizzleNotificationOutbox implements NotificationOutbox {
  private readonly logger = new Logger(DrizzleNotificationOutbox.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(BullMQNotificationDispatchQueue)
    private readonly dispatchQueue: NotificationDispatchQueue,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async enqueue(notification: NewNotificationOutbox): Promise<void> {
    const inserted = await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: NotificationEventId.of(this.ids.next()),
        householdId: notification.householdId ?? null,
        recipientUserId: notification.recipientUserId,
        kind: notification.kind,
        dedupeKey: notification.dedupeKey,
        payload: notification.payload,
        createdAt: this.clock.now(),
      })
      .onConflictDoNothing()
      .returning({ id: schema.notificationsOutbox.id });

    await this.scheduleInserted(inserted);
  }

  async enqueueToAddress(notification: NewAddressNotification): Promise<void> {
    const inserted = await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: NotificationEventId.of(this.ids.next()),
        householdId: notification.householdId,
        recipientUserId: null,
        recipientEmail: notification.email.toLowerCase(),
        recipientLocale: notification.locale,
        kind: notification.kind,
        dedupeKey: notification.dedupeKey,
        payload: notification.payload,
        createdAt: this.clock.now(),
      })
      .onConflictDoNothing()
      .returning({ id: schema.notificationsOutbox.id });

    await this.scheduleInserted(inserted);
  }

  private async scheduleInserted(inserted: readonly { id: NotificationEventId }[]): Promise<void> {
    for (const row of inserted) {
      await this.scheduleNow(row.id);
    }
  }

  /**
   * Notifications should not wait for the 5-minute relay cron. The row is
   * already committed, so a Redis failure here only delays the delivery until
   * the relay picks the row up.
   */
  private async scheduleNow(outboxId: NotificationEventId): Promise<void> {
    try {
      await this.dispatchQueue.schedule(outboxId);
    } catch (err) {
      this.logger.warn(
        `Dispatch of ${outboxId} left to the outbox relay: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
