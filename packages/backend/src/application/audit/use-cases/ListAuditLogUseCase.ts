import type { HouseholdId } from '@power-budget/core';
import type { AuditEventRepository, AuditFilter, AuditPage } from '../../../domain/audit/ports.js';

export interface ListAuditLogInput {
  readonly householdId: HouseholdId;
  readonly filter: AuditFilter;
}

/** Lists the audit trail of the caller's household (audit M21: controllers go through use cases). */
export class ListAuditLogUseCase {
  constructor(private readonly auditRepo: AuditEventRepository) {}

  execute(input: ListAuditLogInput): Promise<AuditPage> {
    return this.auditRepo.listByHousehold(input.filter, { householdId: input.householdId });
  }
}
