import { ApiProperty } from '@nestjs/swagger';
import type { HealthStatus } from './health.service';

export class HealthStatusDto {
  @ApiProperty({ type: String, enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  ts!: string;
}

export function toHealthStatusDto(health: HealthStatus): HealthStatusDto {
  return { status: health.status, ts: health.ts };
}
