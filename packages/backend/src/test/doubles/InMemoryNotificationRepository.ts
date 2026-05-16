import type { UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NewNotificationOutbox,
  NotificationOutbox,
} from '../../notifications/domain/entities.js';
import type { NotificationRepository } from '../../notifications/domain/ports.js';

// Internal mutable representation — avoids `as any` casts for markSent/markFailed/incrementAttempts
interface StoredNotification {
  id: string;
  householdId: NotificationOutbox['householdId'];
  recipientUserId: NotificationOutbox['recipientUserId'];
  kind: NotificationOutbox['kind'];
  dedupeKey: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  attempts: number;
}

type UserRecord = {
  email: string;
  displayName: string;
  locale: string;
  emailBouncing: boolean;
};

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly _outbox: StoredNotification[] = [];
  private readonly users = new Map<string, UserRecord>();

  /** Expose stored notifications as the read-only domain type. */
  get outbox(): NotificationOutbox[] {
    // StoredNotification is structurally identical to NotificationOutbox (minus readonly modifiers)
    return this._outbox;
  }

  addUser(
    userId: string,
    data: { email: string; displayName: string; locale: string; emailBouncing?: boolean },
  ): void {
    this.users.set(userId, { emailBouncing: false, ...data });
  }

  async enqueue(notification: NewNotificationOutbox): Promise<void> {
    this._outbox.push({
      ...notification,
      householdId: notification.householdId ?? null,
      createdAt: new Date(),
      sentAt: null,
      failedAt: null,
      attempts: 0,
    });
  }

  async findPendingBatch(limit: number): Promise<NotificationOutbox[]> {
    return this._outbox.filter((n) => n.sentAt === null && n.failedAt === null).slice(0, limit);
  }

  async markSent(id: string): Promise<void> {
    const n = this._outbox.find((item) => item.id === id);
    if (n) n.sentAt = new Date();
  }

  async markFailed(id: string): Promise<void> {
    const n = this._outbox.find((item) => item.id === id);
    if (n) n.failedAt = new Date();
  }

  async incrementAttempts(id: string): Promise<void> {
    const n = this._outbox.find((item) => item.id === id);
    if (n) n.attempts += 1;
  }

  async listAllHouseholdMembers(): Promise<HouseholdMemberRow[]> {
    return [];
  }

  async findExpiringConnections(): Promise<ExpiringConnectionRow[]> {
    return [];
  }

  async setEmailBouncing(email: string): Promise<void> {
    for (const user of this.users.values()) {
      if (user.email === email) user.emailBouncing = true;
    }
  }

  async findUserById(userId: UserId): Promise<{
    email: string;
    displayName: string;
    locale: string;
    emailBouncing: boolean;
  } | null> {
    return this.users.get(userId) ?? null;
  }
}
