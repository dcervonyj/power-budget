import type { HouseholdId, UserId } from '@power-budget/core';
import type { NotificationKind } from '../../../domain/notifications/entities.js';
import type { NotificationOutbox } from '../../../domain/notifications/ports.js';

export interface EnqueueNotificationInput {
  readonly recipientUserId: UserId;
  readonly householdId?: HouseholdId | null;
  readonly kind: NotificationKind;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
}

export class EnqueueNotificationUseCase {
  constructor(private readonly outbox: NotificationOutbox) {}

  async execute(input: EnqueueNotificationInput): Promise<void> {
    await this.outbox.enqueue({
      recipientUserId: input.recipientUserId,
      householdId: input.householdId ?? null,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
    });
  }
}
