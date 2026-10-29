import { describe, expect, it } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, UserId } from '@power-budget/core';
import type { Page, TransactionListItem } from '../../../../domain/transactions/entities.js';
import type { TransactionRepository } from '../../../../domain/transactions/ports.js';
import { ListTransactionsUseCase } from '../ListTransactionsUseCase.js';

const HOUSEHOLD = HouseholdId.of('01890a5d-ac96-774b-bcce-b302099a8057');

describe('ListTransactionsUseCase', () => {
  it('lists with the query in the caller household scope', async () => {
    const repo = createMock<TransactionRepository>();
    const page: Page<TransactionListItem> = { items: [], nextCursor: null, hasMore: false };
    repo.list.mockResolvedValue(page);
    const query = {
      householdId: HOUSEHOLD,
      ownerUserId: UserId.of('01890a5d-ac96-774b-bcce-b302099a8058'),
      unmappedOnly: true,
      mapped: true,
      transfer: false,
      status: 'pending' as const,
    };

    await expect(
      new ListTransactionsUseCase(repo).execute({ query, householdId: HOUSEHOLD }),
    ).resolves.toBe(page);

    expect(repo.list).toHaveBeenCalledWith(query, { householdId: HOUSEHOLD });
  });
});
