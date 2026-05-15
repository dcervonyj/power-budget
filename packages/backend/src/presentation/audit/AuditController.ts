import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { DrizzleAuditEventRepository } from '../../infrastructure/audit/DrizzleAuditEventRepository.js';
import { ListAuditLogQueryDto } from './dto/audit.dto.js';
import type { AuditEventId } from '../../domain/audit/entities.js';

@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('audit-log')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditRepo: DrizzleAuditEventRepository) {}

  @Get()
  @ApiOperation({ summary: 'List audit log events for the current household' })
  @ApiResponse({ status: 200, description: 'Paginated list of audit events' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Query() query: ListAuditLogQueryDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const result = await this.auditRepo.listByHousehold(
      {
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        from: query.from,
        to: query.to,
        cursor: query.cursor as AuditEventId | undefined,
        limit: query.limit,
      },
      { householdId: user.householdId },
    );

    return result;
  }
}
