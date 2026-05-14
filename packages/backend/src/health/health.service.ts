import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  ts: string;
}

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: 'ok',
      ts: new Date().toISOString(),
    };
  }
}
