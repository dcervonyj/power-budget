import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdPurgeRepository } from '../../../domain/auth/ports.js';
import { PurgeDeletedHouseholdsUseCase } from './PurgeDeletedHouseholdsUseCase.js';

const H1 = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const H2 = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const H3 = '01900000-0000-7000-8000-000000000003' as HouseholdId;
const USER = '01900000-0000-7000-8000-0000000000a1' as UserId;
const NOW = new Date('2026-12-01T03:30:00Z');

describe('PurgeDeletedHouseholdsUseCase', () => {
  let repo: ReturnType<typeof mock<HouseholdPurgeRepository>>;
  let useCase: PurgeDeletedHouseholdsUseCase;

  beforeEach(() => {
    repo = mock<HouseholdPurgeRepository>();
    useCase = new PurgeDeletedHouseholdsUseCase(repo);
  });

  it('purges every due household', async () => {
    repo.findDueHouseholdIds.mockResolvedValue([H1, H2]);
    repo.purge.mockImplementation((id) => Promise.resolve({ householdId: id, deletedUserIds: [] }));

    const output = await useCase.execute(NOW);

    expect(repo.findDueHouseholdIds).toHaveBeenCalledWith(
      NOW,
      PurgeDeletedHouseholdsUseCase.BATCH_SIZE,
    );
    expect(repo.purge.mock.calls).toEqual([
      [H1, NOW],
      [H2, NOW],
    ]);
    expect(output.purged.map((p) => p.householdId)).toEqual([H1, H2]);
    expect(output.failed).toEqual([]);
  });

  it('reports the accounts deleted with the household', async () => {
    repo.findDueHouseholdIds.mockResolvedValue([H1]);
    repo.purge.mockResolvedValue({ householdId: H1, deletedUserIds: [USER] });

    const output = await useCase.execute(NOW);

    expect(output.purged).toEqual([{ householdId: H1, deletedUserIds: [USER] }]);
  });

  it('skips a household whose deletion was cancelled meanwhile', async () => {
    repo.findDueHouseholdIds.mockResolvedValue([H1]);
    repo.purge.mockResolvedValue(null);

    const output = await useCase.execute(NOW);

    expect(output).toEqual({ purged: [], failed: [] });
  });

  it('keeps going after one household fails', async () => {
    const boom = new Error('fk violation');
    repo.findDueHouseholdIds.mockResolvedValue([H1, H2, H3]);
    repo.purge.mockImplementation((id) =>
      id === H2 ? Promise.reject(boom) : Promise.resolve({ householdId: id, deletedUserIds: [] }),
    );

    const output = await useCase.execute(NOW);

    expect(output.purged.map((p) => p.householdId)).toEqual([H1, H3]);
    expect(output.failed).toEqual([{ householdId: H2, error: boom }]);
  });

  it('does nothing when no household is due', async () => {
    repo.findDueHouseholdIds.mockResolvedValue([]);

    const output = await useCase.execute(NOW);

    expect(repo.purge).not.toHaveBeenCalled();
    expect(output).toEqual({ purged: [], failed: [] });
  });
});
