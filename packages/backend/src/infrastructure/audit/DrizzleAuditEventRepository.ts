import { AuditEventId } from '@power-budget/core';
import { Inject, Injectable } from '@nestjs/common';
import { eq, and, gte, lte, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, UserId } from '@power-budget/core';
import { uuidv7 } from 'uuidv7';
import type {
  AuditEventRepository,
  AuditLogger,
  AuditFilter,
  AuditPage,
  HouseholdScope,
} from '../../domain/audit/ports.js';
import type { AuditEvent, NewAuditEvent } from '../../domain/audit/entities.js';
import type { AuditLogPort } from '../../domain/plans/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';
import { isoDateTimeOf } from '../database/row-values.js';

/**
 * Implements AuditEventRepository, AuditLogger, and the legacy AuditLogPort
 * (used by plans use cases). All writes go to the `audit_log` table.
 *
 * Writers must go through RedactingAuditLogger (REDACTING_AUDIT_LOGGER / AUDIT_LOG_PORT);
 * inject this class directly only to read. audit_log is append-only for the app role:
 * `db:roles` revokes UPDATE/DELETE and RLS (0008_rls_tenancy) has no UPDATE/DELETE policy.
 */
@Injectable()
export class DrizzleAuditEventRepository
  implements AuditEventRepository, AuditLogger, AuditLogPort
{
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async log(event: NewAuditEvent): Promise<void> {
    await this.insertAuditEvent(event);
  }

  // AuditLogPort compatibility (used by plans use cases)
  async record(event: {
    readonly householdId: HouseholdId;
    readonly actorUserId: UserId;
    readonly action: string;
    readonly subjectType: string;
    readonly subjectId: string;
  }): Promise<void> {
    await this.insertAuditEvent({
      householdId: event.householdId,
      actorId: event.actorUserId,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      action: event.action,
      meta: {},
    });
  }

  async insertAuditEvent(event: NewAuditEvent): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      id: AuditEventId.of(uuidv7()),
      householdId: event.householdId,
      actorUserId: event.actorId,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      context: event.meta,
      at: new Date(),
    });
  }

  async listByHousehold(filter: AuditFilter, scope: HouseholdScope): Promise<AuditPage> {
    const limit = filter.limit ?? 50;
    const conditions = [eq(schema.auditLog.householdId, scope.householdId)];

    if (filter.subjectType) {
      conditions.push(eq(schema.auditLog.subjectType, filter.subjectType));
    }
    if (filter.subjectId) {
      conditions.push(eq(schema.auditLog.subjectId, filter.subjectId));
    }
    if (filter.from) {
      conditions.push(gte(schema.auditLog.at, new Date(filter.from)));
    }
    if (filter.to) {
      conditions.push(lte(schema.auditLog.at, new Date(filter.to)));
    }
    if (filter.cursor) {
      conditions.push(gt(schema.auditLog.id, filter.cursor));
    }

    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(and(...conditions))
      .orderBy(schema.auditLog.id)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return {
      items: items.map((r) => this.toEntity(r)),
      nextCursor,
      hasMore,
    };
  }

  private toEntity(row: schema.SelectAuditLog): AuditEvent {
    return {
      id: row.id,
      // The listing filters on householdId, so it is set; actor_user_id is nulled when a purge anonymises the row
      // (SET NULL), which AuditEvent does not model yet.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      householdId: row.householdId as HouseholdId,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      actorId: row.actorUserId as UserId,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      action: row.action,
      meta: row.context ?? {},
      occurredAt: isoDateTimeOf(row.at),
    };
  }
}
