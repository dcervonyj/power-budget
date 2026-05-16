import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { TransactionId, PlannedItemId, UserId, PlanId } from '@power-budget/core';
import type { MappingRepository, PlanActualsRefreshPort } from '../../../domain/ports.js';
import { BulkMapTransactionsUseCase } from '../BulkMapTransactionsUseCase.js';

const TX_1 = '01900000-0000-7000-8000-000000000001' as TransactionId;
const TX_2 = '01900000-0000-7000-8000-000000000002' as TransactionId;
const ITEM_1 = '01900000-0000-7000-8000-000000000010' as PlannedItemId;
const ITEM_2 = '01900000-0000-7000-8000-000000000011' as PlannedItemId;
const USER_ID = '01900000-0000-7000-8000-000000000020' as UserId;
const PLAN_ID = '01900000-0000-7000-8000-000000000030' as PlanId;

describe('BulkMapTransactionsUseCase', () => {
  let mappingRepo: ReturnType<typeof mock<MappingRepository>>;
  let refreshPort: ReturnType<typeof mock<PlanActualsRefreshPort>>;
  let useCase: BulkMapTransactionsUseCase;

  beforeEach(() => {
    mappingRepo = mock<MappingRepository>();
    refreshPort = mock<PlanActualsRefreshPort>();
    useCase = new BulkMapTransactionsUseCase(mappingRepo, refreshPort);
    mappingRepo.bulkSet.mockResolvedValue(undefined);
    refreshPort.scheduleRefresh.mockResolvedValue(undefined);
  });

  it('bulk-sets all mappings and schedules a refresh', async () => {
    const mappings = [
      { transactionId: TX_1, plannedItemId: ITEM_1 },
      { transactionId: TX_2, plannedItemId: ITEM_2 },
    ];

    await useCase.execute({ mappings, by: USER_ID, planId: PLAN_ID });

    expect(mappingRepo.bulkSet).toHaveBeenCalledWith(mappings, USER_ID);
    expect(refreshPort.scheduleRefresh).toHaveBeenCalledWith(PLAN_ID);
  });

  it('does nothing when the mappings array is empty', async () => {
    await useCase.execute({ mappings: [], by: USER_ID, planId: PLAN_ID });

    expect(mappingRepo.bulkSet).not.toHaveBeenCalled();
    expect(refreshPort.scheduleRefresh).not.toHaveBeenCalled();
  });

  it('schedules a plan refresh after bulk-setting', async () => {
    await useCase.execute({
      mappings: [{ transactionId: TX_1, plannedItemId: ITEM_1 }],
      by: USER_ID,
      planId: PLAN_ID,
    });

    expect(refreshPort.scheduleRefresh).toHaveBeenCalledOnce();
    expect(refreshPort.scheduleRefresh).toHaveBeenCalledWith(PLAN_ID);
  });
});
