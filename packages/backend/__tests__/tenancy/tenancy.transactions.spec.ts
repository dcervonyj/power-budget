import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
  PlanActualsRefreshPort,
  MappingSuggestionPort,
} from '../../src/transactions/domain/ports.js';
import { TransactionNotFoundError } from '../../src/transactions/domain/errors.js';
import { ListTransactionsUseCase } from '../../src/transactions/application/use-cases/ListTransactionsUseCase.js';
import { GetTransactionUseCase } from '../../src/transactions/application/use-cases/GetTransactionUseCase.js';
import { MapTransactionUseCase } from '../../src/transactions/application/use-cases/MapTransactionUseCase.js';
import { AddManualTransactionUseCase } from '../../src/transactions/application/use-cases/AddManualTransactionUseCase.js';
import { IngestBankTransactionsUseCase } from '../../src/transactions/application/use-cases/IngestBankTransactionsUseCase.js';
import {
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  USER_A,
  TX_ID_A,
  TX_ID_B,
  ACCOUNT_ID,
  PLANNED_ITEM_ID,
  PLAN_ID_A,
  VALID_UUID,
  makeTransaction,
} from './helpers.js';

describe('Tenancy isolation — application layer', () => {
  describe('transactions', () => {
    describe('ListTransactionsUseCase', () => {
      it('scopes list query to the provided householdId', async () => {
        const txRepo = mock<TransactionRepository>();
        const txA = makeTransaction(HOUSEHOLD_A);
        txRepo.list.mockResolvedValue({ items: [txA], nextCursor: null });

        const useCase = new ListTransactionsUseCase(txRepo);
        const result = await useCase.execute({
          householdId: HOUSEHOLD_A,
          query: { householdId: HOUSEHOLD_A },
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.householdId).toBe(HOUSEHOLD_A);
        expect(txRepo.list).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('does not return household B transactions when scoped to household A', async () => {
        const txRepo = mock<TransactionRepository>();
        txRepo.list.mockImplementation(async (_query, scope) => {
          const all = [makeTransaction(HOUSEHOLD_A), makeTransaction(HOUSEHOLD_B)];
          return {
            items: all.filter((t) => t.householdId === scope.householdId),
            nextCursor: null,
          };
        });

        const useCase = new ListTransactionsUseCase(txRepo);
        const result = await useCase.execute({
          householdId: HOUSEHOLD_A,
          query: { householdId: HOUSEHOLD_A },
        });

        expect(result.items.every((t) => t.householdId === HOUSEHOLD_A)).toBe(true);
        expect(result.items.some((t) => t.householdId === HOUSEHOLD_B)).toBe(false);
      });
    });

    describe('GetTransactionUseCase', () => {
      it('returns transaction when it belongs to the correct household', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const transferRepo = mock<TransferRepository>();
        const txA = makeTransaction(HOUSEHOLD_A);

        txRepo.findById.mockResolvedValue(txA);
        mappingRepo.findByTransaction.mockResolvedValue(null);
        transferRepo.findByTransaction.mockResolvedValue(null);

        const useCase = new GetTransactionUseCase(txRepo, mappingRepo, transferRepo);
        const result = await useCase.execute(TX_ID_A, HOUSEHOLD_A);

        expect(result.transaction.householdId).toBe(HOUSEHOLD_A);
        expect(txRepo.findById).toHaveBeenCalledWith(TX_ID_A, { householdId: HOUSEHOLD_A });
      });

      it('throws TransactionNotFoundError when transaction belongs to another household', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const transferRepo = mock<TransferRepository>();

        // The repo correctly returns null when scope doesn't match
        txRepo.findById.mockResolvedValue(null);

        const useCase = new GetTransactionUseCase(txRepo, mappingRepo, transferRepo);

        await expect(useCase.execute(TX_ID_B, HOUSEHOLD_A)).rejects.toThrow(
          TransactionNotFoundError,
        );
      });

      it('passes the householdId scope to the repo', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const transferRepo = mock<TransferRepository>();

        txRepo.findById.mockResolvedValue(null);

        const useCase = new GetTransactionUseCase(txRepo, mappingRepo, transferRepo);
        await expect(useCase.execute(TX_ID_A, HOUSEHOLD_A)).rejects.toThrow(
          TransactionNotFoundError,
        );

        expect(txRepo.findById).toHaveBeenCalledWith(TX_ID_A, { householdId: HOUSEHOLD_A });
      });
    });

    describe('MapTransactionUseCase', () => {
      it('maps a transaction within the correct household scope', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const transferRepo = mock<TransferRepository>();
        const refreshPort = mock<PlanActualsRefreshPort>();
        const txA = makeTransaction(HOUSEHOLD_A);

        txRepo.findById.mockResolvedValue(txA);
        transferRepo.findByTransaction.mockResolvedValue(null);
        mappingRepo.set.mockResolvedValue(undefined);
        refreshPort.scheduleRefresh.mockResolvedValue(undefined);

        const useCase = new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, refreshPort);
        await useCase.execute({
          transactionId: TX_ID_A,
          plannedItemId: PLANNED_ITEM_ID,
          by: USER_A,
          householdId: HOUSEHOLD_A,
          planId: PLAN_ID_A,
        });

        expect(txRepo.findById).toHaveBeenCalledWith(TX_ID_A, { householdId: HOUSEHOLD_A });
        expect(mappingRepo.set).toHaveBeenCalledOnce();
      });

      it('throws TransactionNotFoundError when transaction belongs to household B', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const transferRepo = mock<TransferRepository>();
        const refreshPort = mock<PlanActualsRefreshPort>();

        // Scoped repo returns null for wrong household
        txRepo.findById.mockResolvedValue(null);

        const useCase = new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, refreshPort);

        await expect(
          useCase.execute({
            transactionId: TX_ID_B,
            plannedItemId: PLANNED_ITEM_ID,
            by: USER_A,
            householdId: HOUSEHOLD_A,
            planId: PLAN_ID_A,
          }),
        ).rejects.toThrow(TransactionNotFoundError);

        expect(mappingRepo.set).not.toHaveBeenCalled();
      });
    });

    describe('AddManualTransactionUseCase', () => {
      it('creates transaction tagged with the provided householdId', async () => {
        const txRepo = mock<TransactionRepository>();
        const txA = makeTransaction(HOUSEHOLD_A);
        txRepo.insertManual.mockResolvedValue(txA);

        const useCase = new AddManualTransactionUseCase(txRepo, () => VALID_UUID);
        const result = await useCase.execute({
          householdId: HOUSEHOLD_A,
          accountId: ACCOUNT_ID,
          occurredOn: '2024-01-15',
          amountMinor: 1000n,
          currency: 'EUR',
          description: 'Test transaction',
          merchant: null,
          notes: null,
        });

        expect(result.householdId).toBe(HOUSEHOLD_A);
        expect(txRepo.insertManual).toHaveBeenCalledWith(
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('does not create transaction in household B when called with household A scope', async () => {
        const txRepo = mock<TransactionRepository>();
        const txA = makeTransaction(HOUSEHOLD_A);
        txRepo.insertManual.mockResolvedValue(txA);

        const useCase = new AddManualTransactionUseCase(txRepo, () => VALID_UUID);
        await useCase.execute({
          householdId: HOUSEHOLD_A,
          accountId: ACCOUNT_ID,
          occurredOn: '2024-01-15',
          amountMinor: 1000n,
          currency: 'EUR',
          description: 'Test transaction',
          merchant: null,
          notes: null,
        });

        const insertedArg = txRepo.insertManual.mock.calls[0]![0];
        expect(insertedArg.householdId).toBe(HOUSEHOLD_A);
        expect(insertedArg.householdId).not.toBe(HOUSEHOLD_B);
      });
    });

    describe('IngestBankTransactionsUseCase', () => {
      it('ingests transactions into the specified householdId', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const suggestionPort = mock<MappingSuggestionPort>();
        const txA = makeTransaction(HOUSEHOLD_A);

        txRepo.upsertByExternalId.mockResolvedValue({ id: TX_ID_A, created: true });
        txRepo.findById.mockResolvedValue(txA);
        suggestionPort.suggest.mockReturnValue(null);

        const useCase = new IngestBankTransactionsUseCase(
          txRepo,
          mappingRepo,
          suggestionPort,
          () => VALID_UUID,
        );
        await useCase.execute({
          accountId: ACCOUNT_ID,
          householdId: HOUSEHOLD_A,
          rawTransactions: [
            {
              externalId: 'ext-1',
              occurredOn: '2024-01-15',
              amountMinor: 500n,
              currency: 'EUR',
              description: 'Bank transaction',
              merchant: null,
            },
          ],
        });

        expect(txRepo.upsertByExternalId).toHaveBeenCalledWith(
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('does not ingest into household B when called with household A scope', async () => {
        const txRepo = mock<TransactionRepository>();
        const mappingRepo = mock<MappingRepository>();
        const suggestionPort = mock<MappingSuggestionPort>();

        txRepo.upsertByExternalId.mockResolvedValue({ id: TX_ID_A, created: false });

        const useCase = new IngestBankTransactionsUseCase(
          txRepo,
          mappingRepo,
          suggestionPort,
          () => VALID_UUID,
        );
        await useCase.execute({
          accountId: ACCOUNT_ID,
          householdId: HOUSEHOLD_A,
          rawTransactions: [
            {
              externalId: 'ext-1',
              occurredOn: '2024-01-15',
              amountMinor: 500n,
              currency: 'EUR',
              description: 'Bank transaction',
              merchant: null,
            },
          ],
        });

        const upsertArg = txRepo.upsertByExternalId.mock.calls[0]![0];
        expect(upsertArg.householdId).toBe(HOUSEHOLD_A);
        expect(upsertArg.householdId).not.toBe(HOUSEHOLD_B);
      });
    });
  });
});
