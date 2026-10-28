import type { UserId } from '@power-budget/core';
import {
  SECRET_PAYLOAD_KEYS,
  type ExpiringConnectionRow,
  type HouseholdMemberRow,
  type NewNotificationOutbox,
  type NotificationOutbox,
} from '../../domain/notifications/entities.js';
import type {
  ClaimedRecipient,
  NotificationClaim,
  NotificationRepository,
} from '../../domain/notifications/ports.js';

// Internal mutable representation of an outbox row.
interface StoredNotification {
  id: string;
  householdId: NotificationOutbox['householdId'];
  recipientUserId: NotificationOutbox['recipientUserId'];
  recipientEmail: string | null;
  recipientLocale: string | null;
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

class InMemoryNotificationClaim implements NotificationClaim {
  constructor(
    private readonly row: StoredNotification,
    readonly notification: NotificationOutbox,
    readonly recipient: ClaimedRecipient | null,
  ) {}

  async markSent(): Promise<void> {
    this.row.sentAt = new Date();
    this.scrubSecrets();
  }

  async markFailed(): Promise<void> {
    this.row.failedAt = new Date();
    this.scrubSecrets();
  }

  private scrubSecrets(): void {
    for (const key of SECRET_PAYLOAD_KEYS) {
      delete this.row.payload[key];
    }
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly _outbox: StoredNotification[] = [];
  private readonly users = new Map<string, UserRecord>();

  /** Expose stored notifications as the read-only domain type. */
  get outbox(): NotificationOutbox[] {
    return this._outbox;
  }

  addUser(
    userId: string,
    data: { email: string; displayName: string; locale: string; emailBouncing?: boolean },
  ): void {
    this.users.set(userId, { emailBouncing: false, ...data });
  }

  async enqueue(notification: NewNotificationOutbox): Promise<void> {
    if (this._outbox.some((n) => this.isSameDedupe(n, notification))) {
      return;
    }
    this._outbox.push({
      ...notification,
      payload: { ...notification.payload },
      householdId: notification.householdId ?? null,
      recipientEmail: null,
      recipientLocale: null,
      createdAt: new Date(),
      sentAt: null,
      failedAt: null,
      attempts: 0,
    });
  }

  /** An address-only row, as DrizzleNotificationOutboxPort.enqueueToAddress writes it. */
  enqueueToAddress(
    notification: Omit<NewNotificationOutbox, 'recipientUserId'> & {
      email: string | null;
      locale: string | null;
    },
  ): void {
    this._outbox.push({
      id: notification.id,
      householdId: notification.householdId ?? null,
      recipientUserId: null,
      recipientEmail: notification.email,
      recipientLocale: notification.locale,
      kind: notification.kind,
      dedupeKey: notification.dedupeKey,
      payload: { ...notification.payload },
      createdAt: new Date(),
      sentAt: null,
      failedAt: null,
      attempts: 0,
    });
  }

  async findById(id: string): Promise<NotificationOutbox | null> {
    const row = this._outbox.find((n) => n.id === id);

    return row === undefined ? null : { ...row, payload: { ...row.payload } };
  }

  async findPendingBatch(limit: number): Promise<NotificationOutbox[]> {
    return this._outbox.filter((n) => this.isPending(n)).slice(0, limit);
  }

  async claimForDispatch(id: string): Promise<NotificationClaim | null> {
    const row = this._outbox.find((n) => n.id === id);
    if (row === undefined || !this.isPending(row)) {
      return null;
    }
    row.attempts += 1;
    const user = row.recipientUserId === null ? undefined : this.users.get(row.recipientUserId);
    const recipient =
      user === undefined
        ? null
        : { email: user.email, locale: user.locale, emailBouncing: user.emailBouncing };

    return new InMemoryNotificationClaim(row, { ...row, payload: { ...row.payload } }, recipient);
  }

  async listAllHouseholdMembers(): Promise<HouseholdMemberRow[]> {
    return [];
  }

  async findExpiringConnections(): Promise<ExpiringConnectionRow[]> {
    return [];
  }

  async setEmailBouncing(email: string): Promise<void> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        user.emailBouncing = true;
      }
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

  private isPending(row: StoredNotification): boolean {
    return row.sentAt === null && row.failedAt === null;
  }

  private isSameDedupe(row: StoredNotification, candidate: NewNotificationOutbox): boolean {
    return (
      row.recipientUserId === candidate.recipientUserId &&
      row.kind === candidate.kind &&
      row.dedupeKey === candidate.dedupeKey
    );
  }
}
