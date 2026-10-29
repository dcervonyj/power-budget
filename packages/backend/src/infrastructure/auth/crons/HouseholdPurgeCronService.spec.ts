import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { PurgeDeletedHouseholdsUseCase } from '../../../application/auth/use-cases/PurgeDeletedHouseholdsUseCase.js';
import { HouseholdPurgeCronService } from './HouseholdPurgeCronService.js';

describe('HouseholdPurgeCronService', () => {
  it('runs the purge use case with the current time', async () => {
    const useCase = createMock<PurgeDeletedHouseholdsUseCase>();
    useCase.execute.mockResolvedValue({ purged: [], failed: [] });
    const before = Date.now();

    await new HouseholdPurgeCronService(useCase).runPurge();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    const at = useCase.execute.mock.calls[0]?.[0];
    expect(at?.getTime()).toBeGreaterThanOrEqual(before);
  });
});
