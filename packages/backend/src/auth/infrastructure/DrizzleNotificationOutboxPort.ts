import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserId } from '@power-budget/core';
import type { NotificationOutboxPort } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleNotificationOutboxPort implements NotificationOutboxPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async enqueue(event: {
    kind: string;
    userId: UserId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void> {
    await this.db
      .insert(schema.notificationsOutbox)
      .values({
        id: randomUUID(),
        recipientUserId: event.userId,
        kind: event.kind,
        dedupeKey: event.dedupeKey,
        payload: event.payload,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
}
