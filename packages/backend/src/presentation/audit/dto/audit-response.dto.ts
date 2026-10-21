import { ApiProperty } from '@nestjs/swagger';
import type { AuditEvent } from '../../../domain/audit/entities.js';
import type { AuditPage } from '../../../domain/audit/ports.js';

export class AuditEventDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  householdId!: string;

  @ApiProperty({ type: String, description: 'User who performed the action' })
  actorId!: string;

  @ApiProperty({ type: String, example: 'Plan' })
  subjectType!: string;

  @ApiProperty({ type: String })
  subjectId!: string;

  @ApiProperty({ type: String, example: 'PLAN_CREATED' })
  action!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Redacted event context',
  })
  meta!: Record<string, unknown>;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  occurredAt!: string;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditEventDto] })
  items!: AuditEventDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: Boolean })
  hasMore!: boolean;
}

export function toAuditPageDto(page: AuditPage): AuditPageDto {
  return {
    items: page.items.map(toAuditEventDto),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export function emptyAuditPageDto(): AuditPageDto {
  return { items: [], nextCursor: null, hasMore: false };
}

function toAuditEventDto(event: AuditEvent): AuditEventDto {
  return {
    id: event.id,
    householdId: event.householdId,
    actorId: event.actorId,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    action: event.action,
    meta: event.meta,
    occurredAt: event.occurredAt,
  };
}
