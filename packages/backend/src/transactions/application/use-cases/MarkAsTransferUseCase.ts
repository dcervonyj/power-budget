import type { TransactionId, UserId, HouseholdId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../domain/ports.js';
import { TransactionNotFoundError, AlreadyMappedError } from '../../domain/errors.js';
import type { MarkAsTransferInput } from '../models/index.js';
export type { MarkAsTransferInput };

export class MarkAsTransferUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(input: MarkAsTransferInput): Promise<void> {
    const tx = await this.transactionRepo.findById(input.transactionId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    const existingMapping = await this.mappingRepo.findByTransaction(input.transactionId);
    if (existingMapping !== null) {
      throw new AlreadyMappedError();
    }

    await this.transferRepo.mark(input.transactionId, input.counterpartId, input.by);
  }
}
