import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiQueryFrom } from '../http/ApiQueryFrom.js';
import { AuditEventId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { ListAuditLogUseCase } from '../../application/audit/use-cases/ListAuditLogUseCase.js';
import { ListAuditLogQueryDto } from './dto/audit.dto.js';
import { AuditPageDto, emptyAuditPageDto, toAuditPageDto } from './dto/audit-response.dto.js';

@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('audit-log')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(@Inject(ListAuditLogUseCase) private readonly listAuditLog: ListAuditLogUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List audit log events for the current household' })
  @ApiResponse({ status: 200, description: 'Paginated list of audit events', type: AuditPageDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQueryFrom(ListAuditLogQueryDto)
  async list(
    @Query() query: ListAuditLogQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuditPageDto> {
    if (!user.householdId) {
      return emptyAuditPageDto();
    }

    const page = await this.listAuditLog.execute({
      householdId: user.householdId,
      filter: {
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        from: query.from,
        to: query.to,
        cursor: query.cursor === undefined ? undefined : AuditEventId.of(query.cursor),
        limit: query.limit,
      },
    });

    return toAuditPageDto(page);
  }
}
