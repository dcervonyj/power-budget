import type { HouseholdId } from '@power-budget/core';
import type { NewAuditEvent, AuditEvent, AuditEventId } from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface AuditFilter {
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: AuditEventId;
  readonly limit?: number;
}

export interface AuditPage {
  readonly items: AuditEvent[];
  readonly nextCursor: AuditEventId | null;
  readonly hasMore: boolean;
}

/**
 * AuditLogger is the primary port for recording audit events.
 * It is compatible with the AuditLogPort in domain/plans/ports.ts (which has a `record` method).
 */
export interface AuditLogger {
  log(event: NewAuditEvent): Promise<void>;
}

export interface AuditEventRepository {
  insertAuditEvent(event: NewAuditEvent): Promise<void>;
  listByHousehold(filter: AuditFilter, scope: HouseholdScope): Promise<AuditPage>;
}
