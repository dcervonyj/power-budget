import type { UserId } from '@power-budget/core';
import type {
  ExpiringConnectionRow,
  HouseholdMemberRow,
  NewNotificationOutbox,
  NotificationOutbox,
} from './entities.js';

export interface NotificationRepository {
  enqueue(notification: NewNotificationOutbox): Promise<void>;
  findPendingBatch(limit: number): Promise<NotificationOutbox[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  listAllHouseholdMembers(): Promise<HouseholdMemberRow[]>;
  findExpiringConnections(thresholdDate: Date): Promise<ExpiringConnectionRow[]>;
  setEmailBouncing(email: string): Promise<void>;
  findUserById(
    userId: UserId,
  ): Promise<{ email: string; displayName: string; locale: string; emailBouncing: boolean } | null>;
}

export interface EmailChannel {
  send(input: { to: string; subject: string; html: string; from?: string }): Promise<void>;
}

export interface TemplateRenderer {
  render(kind: string, locale: string, variables: Record<string, string>): Promise<string>;
}
