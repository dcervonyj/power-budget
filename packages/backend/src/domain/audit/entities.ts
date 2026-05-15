import type { HouseholdId, UserId, IsoDateTime } from '@power-budget/core';

type Brand<T, B extends string> = T & { readonly __brand: B };
export type AuditEventId = Brand<string, 'AuditEventId'>;

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
