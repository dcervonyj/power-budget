import type { HouseholdId, UserId, IsoDateTime, AuditEventId } from '@power-budget/core';

export { AuditEventId } from '@power-budget/core';

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly householdId: HouseholdId;
  readonly actorId: UserId;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly action: string;
  readonly meta: Record<string, unknown>;
  readonly occurredAt: IsoDateTime;
}

export type NewAuditEvent = Omit<AuditEvent, 'id' | 'occurredAt'>;
