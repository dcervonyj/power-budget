import type { NotificationEventId } from './ids.js';
import type { NotificationKind } from './enums.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { IsoDateTime } from '../shared/ids.js';

export type NotificationChannel = 'email' | 'push';

export type NotificationStatus = 'pending' | 'dispatched' | 'failed';

export interface Notification {
  readonly id: NotificationEventId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly kind: NotificationKind;
  readonly channel: NotificationChannel;
  readonly status: NotificationStatus;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
  readonly scheduledFor: IsoDateTime;
  readonly sentAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
}
