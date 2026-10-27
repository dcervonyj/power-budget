import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NewNotificationOutbox,
  NotificationOutbox,
  WeeklyDigestSummary,
} from './entities.js';

/** The account a claimed row addresses, read in the claim transaction. */
export interface ClaimedRecipient {
  readonly email: string;
  readonly locale: string;
  readonly emailBouncing: boolean;
}

/**
 * A pending outbox row claimed by one dispatch attempt. `notification.attempts`
 * already counts the current attempt. The claim holds no connection: the row
 * lock is released when the claim commits, and each terminal mark is its own
 * short statement. Both marks strip the secret payload keys (SECRET_PAYLOAD_KEYS).
 */
export interface NotificationClaim {
  readonly notification: NotificationOutbox;
  /** The user behind `notification.recipientUserId`; null for an address-only row or a missing user. */
  readonly recipient: ClaimedRecipient | null;
  markSent(): Promise<void>;
  markFailed(): Promise<void>;
}

export interface NotificationRepository {
  enqueue(notification: NewNotificationOutbox): Promise<void>;
  findById(id: string): Promise<NotificationOutbox | null>;
  findPendingBatch(limit: number): Promise<NotificationOutbox[]>;
  /**
   * Claims a pending row (sent_at and failed_at unset) in one short transaction:
   * counts the attempt and reads the recipient, then commits. Returns null when
   * the row is no longer pending or another claim holds it at this instant. The
   * send happens outside any transaction; the provider idempotency key covers
   * two attempts that overlap.
   */
  claimForDispatch(id: string): Promise<NotificationClaim | null>;
  listAllHouseholdMembers(): Promise<HouseholdMemberRow[]>;
  findExpiringConnections(thresholdDate: Date): Promise<ExpiringConnectionRow[]>;
  setEmailBouncing(email: string): Promise<void>;
  findUserById(
    userId: UserId,
  ): Promise<{ email: string; displayName: string; locale: string; emailBouncing: boolean } | null>;
}

/** Schedules the delivery of one outbox row (BullMQ in production). */
export interface NotificationDispatchQueue {
  schedule(outboxId: string): Promise<void>;
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  /**
   * Same key on every retry of one notification, so the provider delivers it
   * once even when an earlier attempt was accepted but not acknowledged.
   */
  readonly idempotencyKey: string;
  readonly from?: string;
}

export interface EmailChannel {
  send(message: EmailMessage): Promise<void>;
}

export interface TemplateRenderer {
  render(kind: string, locale: string, variables: Record<string, string>): Promise<string>;
}

export interface WeeklyDigestSummaryReader {
  /** The recipient's active plan at `at`, or null when there is none. */
  read(
    member: { readonly householdId: HouseholdId; readonly userId: UserId },
    at: Date,
  ): Promise<WeeklyDigestSummary | null>;
}
