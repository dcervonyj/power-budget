import type { TransactionId, HouseholdId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../domain/transactions/ports.js';
import type {
  Transaction,
  TransactionMapping,
  Transfer,
} from '../../../domain/transactions/entities.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';

export interface TransactionDetail {
  readonly transaction: Transaction;
  readonly mapping: TransactionMapping | null;
  readonly transfer: Transfer | null;
}

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
