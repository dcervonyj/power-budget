import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { PlanId, HouseholdId } from '@power-budget/core';
import { QUEUE_REFRESH_PLAN_ACTUALS } from '../queue/queue.constants.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';
import { customBackoffStrategy } from '../queue/retry-config.js';

export interface RefreshPlanActualsJobPayload {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
}

@Processor(QUEUE_REFRESH_PLAN_ACTUALS, {
  concurrency: 1,
  settings: {
    backoffStrategy: customBackoffStrategy,
  },
})
export class RecomputePlanActualsProcessor extends WorkerHost {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job<RefreshPlanActualsJobPayload>): Promise<void> {
    await this.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY v_plan_actuals`);
  }
}
