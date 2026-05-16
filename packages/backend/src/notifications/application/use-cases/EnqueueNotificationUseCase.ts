import { randomUUID } from 'node:crypto';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { NotificationKind } from '../../domain/entities.js';
import type { NotificationRepository } from '../../domain/ports.js';
import type { EnqueueNotificationInput } from '../models/index.js';
export type { EnqueueNotificationInput };

export class EnqueueNotificationUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(input: EnqueueNotificationInput): Promise<void> {
    await this.notificationRepo.enqueue({
      id: randomUUID(),
      recipientUserId: input.recipientUserId,
      householdId: input.householdId ?? null,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
    });
  }
}
