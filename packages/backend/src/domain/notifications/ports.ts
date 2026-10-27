import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NewNotificationOutbox,
  NotificationOutbox,
  WeeklyDigestSummary,
} from './entities.js';

/**
 * An outbox row held exclusively by one dispatcher. `notification.attempts`
 * already counts the current attempt. Both terminal marks strip the secret
 * payload keys (SECRET_PAYLOAD_KEYS).
 */
export interface NotificationClaim {
  readonly notification: NotificationOutbox;
  markSent(): Promise<void>;
  markFailed(): Promise<void>;
}

export interface NotificationClaimHandler<R> {
  handle(claim: NotificationClaim): Promise<R>;
}

/**
 * `claimed`: the handler ran while this dispatcher held the row.
 * `unavailable`: another dispatcher holds the row, or it is no longer pending.
 */
export type NotificationClaimOutcome<R> =
  { readonly status: 'claimed'; readonly result: R } | { readonly status: 'unavailable' };

export interface NotificationRepository {
  enqueue(notification: NewNotificationOutbox): Promise<void>;
  findById(id: string): Promise<NotificationOutbox | null>;
  findPendingBatch(limit: number): Promise<NotificationOutbox[]>;
  /**
   * Atomically claims a pending row (sent_at and failed_at unset), counts the
   * attempt and runs the handler while the claim is held. The handler must not
   * throw for a delivery failure: it returns the outcome instead, so the
   * attempt count is kept.
   */
  claimForDispatch<R>(
    id: string,
    handler: NotificationClaimHandler<R>,
  ): Promise<NotificationClaimOutcome<R>>;
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
  /** One digest run at `at`: each plan's numbers and the FX table are computed once per run. */
  startRun(at: Date): WeeklyDigestRun;
}

export interface WeeklyDigestRun {
  /** The recipient's active plan at the run time, or null when there is none. */
  read(member: {
    readonly householdId: HouseholdId;
    readonly userId: UserId;
  }): Promise<WeeklyDigestSummary | null>;
}
