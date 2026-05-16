import type { TransactionId, HouseholdId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../domain/ports.js';
import type { Transaction, TransactionMapping, Transfer } from '../../domain/entities.js';
import { TransactionNotFoundError } from '../../domain/errors.js';
import type { TransactionDetail } from '../models/index.js';
export type { TransactionDetail };

export class GetTransactionUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(id: TransactionId, householdId: HouseholdId): Promise<TransactionDetail> {
    const transaction = await this.transactionRepo.findById(id, { householdId });
    if (transaction === null) {
      throw new TransactionNotFoundError();
    }

    const [mapping, transfer] = await Promise.all([
      this.mappingRepo.findByTransaction(id),
      this.transferRepo.findByTransaction(id),
    ]);

    return { transaction, mapping, transfer };
  }
}
