import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { uuidv7 } from 'uuidv7';
import { IsoDate } from '@power-budget/core';
import { startContainers, stopContainers, resetState, getDb, getPool } from './setup.js';
import { insertTestUser, insertTestHousehold } from './test-helpers.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';

/** CLN-042 (audit BE-16): the period-close query catches up every plan that has no snapshot yet. */
describe('DrizzlePlanRepository.findDueForClose (real database)', () => {
  let repo: DrizzlePlanRepository;
  let householdId: string;
  let userId: string;

  beforeAll(async () => {
    await startContainers();
  }, 90_000);

  afterAll(async () => {
    await stopContainers();
  }, 30_000);

  beforeEach(async () => {
    await resetState();
    repo = new DrizzlePlanRepository(getDb());
    userId = (await insertTestUser(getDb(), { id: uuidv7() })).id;
    householdId = (await insertTestHousehold(getDb(), { id: uuidv7() })).id;
  });

  async function insertPlan(periodEnd: string, archived = false): Promise<string> {
    const id = uuidv7();
    await getPool().query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency, archived_at)
       VALUES ($1, $2, $3, $4, 'household', 'monthly', '2026-01-01', $5, 'PLN', $6)`,
      [id, householdId, userId, `plan ${periodEnd}`, periodEnd, archived ? new Date() : null],
    );

    return id;
  }

  async function insertSnapshot(planId: string, periodEnd: string): Promise<void> {
    await getPool().query(
      `INSERT INTO leftover_snapshots (id, household_id, plan_id, period_end, amount_minor, currency)
       VALUES ($1, $2, $3, $4, 100, 'PLN')`,
      [uuidv7(), householdId, planId, periodEnd],
    );
  }

  it('returns plans that ended before the day, including ones missed by earlier runs', async () => {
    const yesterday = await insertPlan('2026-10-20');
    const missed = await insertPlan('2026-10-10');
    await insertPlan('2026-10-21');
    await insertPlan('2026-10-31');

    const due = await repo.findDueForClose(IsoDate.of('2026-10-21'));

    expect(due.map((plan) => plan.id)).toEqual([missed, yesterday]);
  });

  it('skips plans that already have a snapshot for their period end and archived plans', async () => {
    const open = await insertPlan('2026-10-20');
    const closed = await insertPlan('2026-10-19');
    await insertSnapshot(closed, '2026-10-19');
    await insertPlan('2026-10-18', true);

    const due = await repo.findDueForClose(IsoDate.of('2026-10-21'));

    expect(due.map((plan) => plan.id)).toEqual([open]);
  });
});
