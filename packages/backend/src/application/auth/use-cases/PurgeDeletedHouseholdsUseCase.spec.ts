import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdPurgeRepository } from '../../../domain/auth/ports.js';
import { PurgeDeletedHouseholdsUseCase } from './PurgeDeletedHouseholdsUseCase.js';

const H1 = HouseholdId.of('01900000-0000-7000-8000-000000000001');
const H2 = HouseholdId.of('01900000-0000-7000-8000-000000000002');
const H3 = HouseholdId.of('01900000-0000-7000-8000-000000000003');
const USER = UserId.of('01900000-0000-7000-8000-0000000000a1');
const NOW = new Date('2026-12-01T03:30:00Z');

describe('PurgeDeletedHouseholdsUseCase', () => {
  let repo: ReturnType<typeof createMock<HouseholdPurgeRepository>>;
  let useCase: PurgeDeletedHouseholdsUseCase;

  beforeEach(() => {
    repo = createMock<HouseholdPurgeRepository>();
    useCase = new PurgeDeletedHouseholdsUseCase(repo);
  });

  it('purges every due household', async () => {
    repo.findDueHouseholdIds.mockResolvedValueOnce([H1, H2]).mockResolvedValue([]);
    repo.purge.mockImplementation((id) => Promise.resolve({ householdId: id, deletedUserIds: [] }));

    const output = await useCase.execute(NOW);

    expect(repo.findDueHouseholdIds.mock.calls[0]).toEqual([
      NOW,
      PurgeDeletedHouseholdsUseCase.BATCH_SIZE,
      [],
    ]);
    expect(repo.purge.mock.calls).toEqual([
      [H1, NOW],
      [H2, NOW],
    ]);
    expect(output.purged.map((p) => p.householdId)).toEqual([H1, H2]);
    expect(output.failed).toEqual([]);
  });

  it('reports the accounts deleted with the household', async () => {
    repo.findDueHouseholdIds.mockResolvedValueOnce([H1]).mockResolvedValue([]);
    repo.purge.mockResolvedValue({ householdId: H1, deletedUserIds: [USER] });

    const output = await useCase.execute(NOW);

    expect(output.purged).toEqual([{ householdId: H1, deletedUserIds: [USER] }]);
  });

  it('skips a household whose deletion was cancelled meanwhile', async () => {
    repo.findDueHouseholdIds.mockResolvedValueOnce([H1]).mockResolvedValue([]);
    repo.purge.mockResolvedValue(null);

    const output = await useCase.execute(NOW);

    expect(output).toEqual({ purged: [], failed: [] });
  });

  it('keeps going after one household fails', async () => {
    const boom = new Error('fk violation');
    repo.findDueHouseholdIds.mockResolvedValueOnce([H1, H2, H3]).mockResolvedValue([]);
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

  it('pages past a failing household instead of retrying it, so it cannot block the others', async () => {
    repo.findDueHouseholdIds
      .mockResolvedValueOnce([H1])
      .mockResolvedValueOnce([H2])
      .mockResolvedValue([]);
    repo.purge.mockImplementation((id) =>
      id === H1
        ? Promise.reject(new Error('stuck'))
        : Promise.resolve({ householdId: id, deletedUserIds: [] }),
    );

    const output = await useCase.execute(NOW);

    expect(repo.findDueHouseholdIds.mock.calls[1]?.[2]).toEqual([H1]);
    expect(output.purged.map((p) => p.householdId)).toEqual([H2]);
    expect(output.failed.map((f) => f.householdId)).toEqual([H1]);
  });
});
