import type { AuditLogger } from '../../domain/audit/ports.js';
import type { AuditLogPort } from '../../domain/plans/ports.js';

type AuditRecord = Parameters<AuditLogPort['record']>[0];

/** Adapts the plans AuditLogPort (`record`) to the audit module's AuditLogger (`log`). */
export class AuditLogPortAdapter implements AuditLogPort {
  constructor(private readonly logger: AuditLogger) {}

  record(event: AuditRecord): Promise<void> {
    return this.logger.log({
      householdId: event.householdId,
      actorId: event.actorUserId,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      meta: {},
    });
  }
}
