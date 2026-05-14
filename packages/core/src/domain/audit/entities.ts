import type { AuditEventId } from './ids.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { IsoDateTime } from '../shared/ids.js';

export type AuditAction =
  | 'plan.created'
  | 'plan.updated'
  | 'plan.deleted'
  | 'planned_item.created'
  | 'planned_item.updated'
  | 'planned_item.deleted'
  | 'mapping.created'
  | 'mapping.deleted'
  | 'bank_connection.created'
  | 'bank_connection.disconnected'
  | 'household.member_invited'
  | 'household.member_joined'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'auth.totp_enabled'
  | 'auth.totp_disabled';

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly action: AuditAction;
  readonly entityKind: string;
  readonly entityId: string;
  readonly diff: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: IsoDateTime;
}
