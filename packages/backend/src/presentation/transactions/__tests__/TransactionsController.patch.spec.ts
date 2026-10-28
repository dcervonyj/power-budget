import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { HouseholdId, UserId } from '@power-budget/core';
import { TransactionsController } from '../TransactionsController.js';
import type { ListTransactionsUseCase } from '../../../application/transactions/use-cases/ListTransactionsUseCase.js';
import type { GetTransactionUseCase } from '../../../application/transactions/use-cases/GetTransactionUseCase.js';
import type { AddManualTransactionUseCase } from '../../../application/transactions/use-cases/AddManualTransactionUseCase.js';
import type { MapTransactionUseCase } from '../../../application/transactions/use-cases/MapTransactionUseCase.js';
import type { BulkActOnTransactionsUseCase } from '../../../application/transactions/use-cases/BulkActOnTransactionsUseCase.js';
import type { BulkMapTransactionsUseCase } from '../../../application/transactions/use-cases/BulkMapTransactionsUseCase.js';
import type { MarkAsTransferUseCase } from '../../../application/transactions/use-cases/MarkAsTransferUseCase.js';
import type { UnmarkTransferUseCase } from '../../../application/transactions/use-cases/UnmarkTransferUseCase.js';
import type { PatchTransactionUseCase } from '../../../application/transactions/use-cases/PatchTransactionUseCase.js';
import type { AuthenticatedUser } from '../../auth/decorators/CurrentUser.js';
import { PatchTransactionDto } from '../dto/transactions.dto.js';

const TX_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const user = {
  userId: UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6'),
  householdId: HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6'),
} as unknown as AuthenticatedUser;

describe('TransactionsController.patch', () => {
  it('passes notes: null through so the note is cleared', async () => {
    const patchTransaction = mock<PatchTransactionUseCase>();
    const getTransaction = mock<GetTransactionUseCase>();
    getTransaction.execute.mockRejectedValue(new Error('stop after patch'));
    const controller = new TransactionsController(
      mock<ListTransactionsUseCase>(),
      getTransaction,
      mock<AddManualTransactionUseCase>(),
      mock<MapTransactionUseCase>(),
      mock<BulkMapTransactionsUseCase>(),
      mock<BulkActOnTransactionsUseCase>(),
      mock<MarkAsTransferUseCase>(),
      mock<UnmarkTransferUseCase>(),
      patchTransaction,
    );
    const dto = Object.assign(new PatchTransactionDto(), { notes: null });

    await expect(controller.patch(TX_ID, dto, user)).rejects.toThrow('stop after patch');

    expect(patchTransaction.execute).toHaveBeenCalledWith({
      transactionId: TX_ID,
      householdId: '01900000-b56d-7643-8d0f-31b1680a84b6',
      userId: '01900000-9dff-7fe4-8508-52c20c8876f6',
      patch: { notes: null, ignored: undefined },
    });
  });
});
