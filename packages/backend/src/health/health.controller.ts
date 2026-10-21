import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthStatusDto, toHealthStatusDto } from './health-response.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('/health')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is up', type: HealthStatusDto })
  health(): HealthStatusDto {
    return toHealthStatusDto(this.healthService.check());
  }
}
