import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  BankConnectionId,
  HouseholdId,
  PlanId,
  PlannedItemId,
  UserId,
  TransactionId,
  BankAccountId,
  CategoryId,
  PlanActualsView,
} from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry, BankSyncQueuePort } from '../src/domain/bank/ports.js';
import type { BankConnection } from '../src/domain/bank/entities.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
} from '../src/domain/bank/errors.js';
import { ListUserConnectionsUseCase } from '../src/application/bank/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../src/application/bank/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../src/application/bank/use-cases/DisconnectBankUseCase.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
  PlanActualsReader,
} from '../src/domain/plans/ports.js';
import type { Plan, PlannedItem } from '../src/domain/plans/entities.js';
import { ListActivePlansUseCase } from '../src/application/plans/use-cases/ListActivePlansUseCase.js';
import { CreatePlanUseCase } from '../src/application/plans/use-cases/CreatePlanUseCase.js';
import { UpdatePlanUseCase } from '../src/application/plans/use-cases/UpdatePlanUseCase.js';
import { GetPlanDashboardUseCase } from '../src/application/plans/use-cases/GetPlanDashboardUseCase.js';
import { AddPlannedItemUseCase } from '../src/application/plans/use-cases/AddPlannedItemUseCase.js';
import { UpdatePlannedItemUseCase } from '../src/application/plans/use-cases/UpdatePlannedItemUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
  PlanActualsRefreshPort,
  MappingSuggestionPort,
} from '../src/domain/transactions/ports.js';
import type { Transaction } from '../src/domain/transactions/entities.js';
import { TransactionNotFoundError } from '../src/domain/transactions/errors.js';
import { ListTransactionsUseCase } from '../src/application/transactions/use-cases/ListTransactionsUseCase.js';
import { GetTransactionUseCase } from '../src/application/transactions/use-cases/GetTransactionUseCase.js';
import { MapTransactionUseCase } from '../src/application/transactions/use-cases/MapTransactionUseCase.js';
import { AddManualTransactionUseCase } from '../src/application/transactions/use-cases/AddManualTransactionUseCase.js';
import { IngestBankTransactionsUseCase } from '../src/application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  AppConfigPort,
} from '../src/domain/auth/ports.js';
import type { Household } from '../src/domain/auth/entities.js';
import { AlreadyInHouseholdError, UserNotFoundError } from '../src/domain/auth/errors.js';
import { CreateHouseholdUseCase } from '../src/application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../src/application/auth/use-cases/InviteToHouseholdUseCase.js';
import type { AuditLogger } from '../src/domain/audit/ports.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOUSEHOLD_A = '01900000-0000-7000-8000-aaaaaaaaaaaa' as HouseholdId;
const HOUSEHOLD_B = '01900000-0000-7000-8000-bbbbbbbbbbbb' as HouseholdId;
const USER_A = '01900000-0000-7000-8000-000000000001' as UserId;
const USER_B = '01900000-0000-7000-8000-000000000002' as UserId;
const PLAN_ID_A = '01900000-0000-7000-8000-00000000aa01' as PlanId;
const PLAN_ID_B = '01900000-0000-7000-8000-00000000bb01' as PlanId;
const TX_ID_A = '01900000-0000-7000-8000-00000000aa02' as TransactionId;
const TX_ID_B = '01900000-0000-7000-8000-00000000bb02' as TransactionId;
const CONN_ID_A = '01900000-0000-7000-8000-00000000aa03' as BankConnectionId;
const CONN_ID_B = '01900000-0000-7000-8000-00000000bb03' as BankConnectionId;
const ACCOUNT_ID = '01900000-0000-7000-8000-00000000aa04' as BankAccountId;
const CATEGORY_ID = '01900000-0000-7000-8000-00000000aa05' as CategoryId;
const PLANNED_ITEM_ID = '01900000-0000-7000-8000-00000000aa06' as PlannedItemId;
// Valid UUIDv7 to use as generated IDs in use cases
const VALID_UUID = '01900000-0000-7000-8000-00000000ff01';

function makeBankConnection(
  householdId: HouseholdId,
  overrides?: Partial<BankConnection>,
): BankConnection {
  return {
    id: householdId === HOUSEHOLD_A ? CONN_ID_A : CONN_ID_B,
    householdId,
    userId: householdId === HOUSEHOLD_A ? USER_A : USER_B,
    provider: 'gocardless',
    bankId: 'TEST_BANK',
    externalConsentRef: null,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makePlan(householdId: HouseholdId): Plan {
  return {
    id: householdId === HOUSEHOLD_A ? PLAN_ID_A : PLAN_ID_B,
    householdId,
    ownerUserId: USER_A,
    name: `Plan for ${householdId}`,
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01', end: '2024-01-31' },
    baseCurrency: 'EUR',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeTransaction(householdId: HouseholdId): Transaction {
  return {
    id: householdId === HOUSEHOLD_A ? TX_ID_A : TX_ID_B,
    householdId,
    accountId: ACCOUNT_ID,
    externalId: null,
    occurredOn: '2024-01-15',
    amount: { amountMinor: 1000n, currency: 'EUR' },
    description: `tx for ${householdId}`,
    merchant: null,
    source: 'manual',
    status: 'posted',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2024-01-15T00:00:00.000Z',
  };
}

function makeHousehold(householdId: HouseholdId): Household {
  return {
    id: householdId,
    name: `Household ${householdId}`,
    baseCurrency: 'EUR',
    createdAt: new Date('2024-01-01'),
  };
}

function makePlanActualsView(planId: PlanId): PlanActualsView {
  return {
    planId,
    period: { start: '2024-01-01', end: '2024-01-31' },
    baseCurrency: 'EUR',
    incomeLines: [],
    expenseLines: [],
    totalPlannedIncome: { amountMinor: 0n, currency: 'EUR' },
    totalActualIncome: { amountMinor: 0n, currency: 'EUR' },
    totalPlannedExpenses: { amountMinor: 0n, currency: 'EUR' },
    totalActualExpenses: { amountMinor: 0n, currency: 'EUR' },
    unplannedExpenses: { amountMinor: 0n, currency: 'EUR' },
    unplannedIncome: { amountMinor: 0n, currency: 'EUR' },
    net: { amountMinor: 0n, currency: 'EUR' },
    asOf: '2024-01-15',
  };
}

function makePlannedItem(householdId: HouseholdId): PlannedItem {
  return {
    id: PLANNED_ITEM_ID,
    planId: householdId === HOUSEHOLD_A ? PLAN_ID_A : PLAN_ID_B,
    householdId,
    categoryId: CATEGORY_ID,
    direction: 'expense',
    amount: { amountMinor: 500n, currency: 'EUR' },
    note: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tenancy isolation — application layer', () => {
  describe('bank connections', () => {
    it('returns only connections belonging to the requested user', async () => {
      const repo = mock<BankConnectionRepository>();
      const connA = makeBankConnection(HOUSEHOLD_A);
      repo.listByUser.mockResolvedValue([connA]);

      const useCase = new ListUserConnectionsUseCase(repo);
      const result = await useCase.execute({ userId: USER_A });

      expect(result).toHaveLength(1);
      expect(result[0]?.householdId).toBe(HOUSEHOLD_A);
      expect(result.some((c) => c.householdId === HOUSEHOLD_B)).toBe(false);
    });

    it('returns an empty list when the user has no connections', async () => {
      const repo = mock<BankConnectionRepository>();
      repo.listByUser.mockResolvedValue([]);

      const useCase = new ListUserConnectionsUseCase(repo);
      const result = await useCase.execute({ userId: USER_A });

      expect(result).toHaveLength(0);
    });

    it('passes the correct userId to the repository', async () => {
      const repo = mock<BankConnectionRepository>();
      repo.listByUser.mockResolvedValue([]);

      const useCase = new ListUserConnectionsUseCase(repo);
      await useCase.execute({ userId: USER_A });

      expect(repo.listByUser).toHaveBeenCalledOnce();
      expect(repo.listByUser).toHaveBeenCalledWith(USER_A);
    });
  });

  describe('plans', () => {
    it('scopes listActive to the provided householdId', async () => {
      const repo = mock<PlanRepository>();
      const planA = makePlan(HOUSEHOLD_A);
      repo.listActive.mockResolvedValue([planA]);

      const useCase = new ListActivePlansUseCase(repo);
      const today = new Date('2024-01-15T12:00:00Z');
      const result = await useCase.execute({
        userId: USER_A,
        householdId: HOUSEHOLD_A,
        date: today,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.householdId).toBe(HOUSEHOLD_A);
      expect(result.some((p) => p.householdId === HOUSEHOLD_B)).toBe(false);
    });

    it('passes householdId through to the repository query', async () => {
      const repo = mock<PlanRepository>();
      repo.listActive.mockResolvedValue([]);

      const useCase = new ListActivePlansUseCase(repo);
      const today = new Date('2024-01-15T12:00:00Z');
      await useCase.execute({ userId: USER_A, householdId: HOUSEHOLD_A, date: today });

      expect(repo.listActive).toHaveBeenCalledOnce();
      expect(repo.listActive).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: HOUSEHOLD_A }),
      );
    });

    it('does not leak Household B plans when called with Household A scope', async () => {
      const repo = mock<PlanRepository>();
      // Simulate the repo correctly scoping the query (application contract).
      repo.listActive.mockImplementation(async ({ householdId }) => {
        const all = [makePlan(HOUSEHOLD_A), makePlan(HOUSEHOLD_B)];

        return all.filter((p) => p.householdId === householdId);
      });

      const useCase = new ListActivePlansUseCase(repo);
      const today = new Date('2024-01-15T12:00:00Z');
      const result = await useCase.execute({
        userId: USER_A,
        householdId: HOUSEHOLD_A,
        date: today,
      });

      expect(result.every((p) => p.householdId === HOUSEHOLD_A)).toBe(true);
      expect(result.some((p) => p.householdId === HOUSEHOLD_B)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Auth / Household
  // ---------------------------------------------------------------------------

  describe('auth / household', () => {
    describe('CreateHouseholdUseCase', () => {
      it('creates a household for the requesting user only', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const hhA = makeHousehold(HOUSEHOLD_A);

        householdRepo.findByUserId.mockResolvedValue(null);
        householdRepo.create.mockResolvedValue(hhA);
        householdRepo.addMember.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'owner',
          joinedAt: new Date(),
        });

        const useCase = new CreateHouseholdUseCase(householdRepo, userRepo);
        const result = await useCase.execute({ userId: USER_A, name: 'Household A' });

        expect(result.id).toBe(HOUSEHOLD_A);
        expect(householdRepo.create).toHaveBeenCalledOnce();
        expect(householdRepo.addMember).toHaveBeenCalledWith(expect.any(String), USER_A, 'owner');
      });

      it('throws AlreadyInHouseholdError when user already has a household', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();

        // User A already belongs to household A
        householdRepo.findByUserId.mockResolvedValue(makeHousehold(HOUSEHOLD_A));

        const useCase = new CreateHouseholdUseCase(householdRepo, userRepo);

        await expect(
          useCase.execute({ userId: USER_A, name: 'Another Household' }),
        ).rejects.toThrow(AlreadyInHouseholdError);
      });
    });

    describe('InviteToHouseholdUseCase', () => {
      it('allows owner of household A to invite to household A', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        householdRepo.findMembership.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'owner',
          joinedAt: new Date(),
        });
        inviteRepo.create.mockResolvedValue({
          id: 'invite-1',
          householdId: HOUSEHOLD_A,
          email: 'invitee@example.com',
          tokenHash: 'hash',
          expiresAt: new Date(Date.now() + 86400000),
          acceptedAt: null,
          createdAt: new Date(),
        });
        config.get.mockReturnValue('https://app.example.com');

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);
        const result = await useCase.execute({
          inviterUserId: USER_A,
          inviteeEmail: 'invitee@example.com',
          householdId: HOUSEHOLD_A,
        });

        expect(result.inviteUrl).toContain('https://app.example.com');
        expect(householdRepo.findMembership).toHaveBeenCalledWith(HOUSEHOLD_A, USER_A);
      });

      it('throws when user tries to invite to another household they are not owner of', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        // USER_A has no membership in HOUSEHOLD_B
        householdRepo.findMembership.mockResolvedValue(null);

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);

        await expect(
          useCase.execute({
            inviterUserId: USER_A,
            inviteeEmail: 'victim@example.com',
            householdId: HOUSEHOLD_B,
          }),
        ).rejects.toThrow(UserNotFoundError);
      });

      it('throws when user is only a member (not owner) of household', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        householdRepo.findMembership.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'member',
          joinedAt: new Date(),
        });

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);

        await expect(
          useCase.execute({
            inviterUserId: USER_A,
            inviteeEmail: 'invitee@example.com',
            householdId: HOUSEHOLD_A,
          }),
        ).rejects.toThrow(UserNotFoundError);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Bank connections — RefreshConnectionUseCase & DisconnectBankUseCase
  // ---------------------------------------------------------------------------

  describe('bank connections — refresh & disconnect', () => {
    describe('RefreshConnectionUseCase', () => {
      it('succeeds when connection belongs to requesting household and user', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const syncQueue = mock<BankSyncQueuePort>();
        const connA = makeBankConnection(HOUSEHOLD_A);
        connRepo.findById.mockResolvedValue(connA);
        syncQueue.enqueue.mockResolvedValue({ jobId: 'job-1' });

        const useCase = new RefreshConnectionUseCase(connRepo, syncQueue);
        const result = await useCase.execute({
          connectionId: CONN_ID_A,
          householdId: HOUSEHOLD_A,
          userId: USER_A,
        });

        expect(result).toBeDefined();
        expect(connRepo.findById).toHaveBeenCalledWith(CONN_ID_A, { householdId: HOUSEHOLD_A });
      });

      it('throws BankConnectionNotFoundError when connection is in household B', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const syncQueue = mock<BankSyncQueuePort>();
        // Scoped repo returns null for wrong household
        connRepo.findById.mockResolvedValue(null);

        const useCase = new RefreshConnectionUseCase(connRepo, syncQueue);

        await expect(
          useCase.execute({
            connectionId: CONN_ID_B,
            householdId: HOUSEHOLD_A,
            userId: USER_A,
          }),
        ).rejects.toThrow(BankConnectionNotFoundError);
      });

      it('throws BankConnectionForbiddenError when userId does not match connection owner', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const syncQueue = mock<BankSyncQueuePort>();
        // Connection found (correct household) but owned by USER_B
        const connOwnedByB = makeBankConnection(HOUSEHOLD_A, { userId: USER_B });
        connRepo.findById.mockResolvedValue(connOwnedByB);

        const useCase = new RefreshConnectionUseCase(connRepo, syncQueue);

        await expect(
          useCase.execute({
            connectionId: CONN_ID_A,
            householdId: HOUSEHOLD_A,
            userId: USER_A,
          }),
        ).rejects.toThrow(BankConnectionForbiddenError);
      });
    });

    describe('DisconnectBankUseCase', () => {
      it('succeeds when connection belongs to requesting household and user', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const registry = mock<BankConnectorRegistry>();
        const auditLogger = mock<AuditLogger>();
        const connA = makeBankConnection(HOUSEHOLD_A);

        connRepo.findById.mockResolvedValue(connA);
        connRepo.markDisconnected.mockResolvedValue(undefined);
        auditLogger.log.mockResolvedValue(undefined);

        const useCase = new DisconnectBankUseCase(connRepo, registry, auditLogger);
        await useCase.execute({
          connectionId: CONN_ID_A,
          householdId: HOUSEHOLD_A,
          userId: USER_A,
        });

        expect(connRepo.markDisconnected).toHaveBeenCalledWith(CONN_ID_A, expect.any(Date));
        expect(connRepo.findById).toHaveBeenCalledWith(CONN_ID_A, { householdId: HOUSEHOLD_A });
      });

      it('throws BankConnectionNotFoundError when connection is in household B', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const registry = mock<BankConnectorRegistry>();
        const auditLogger = mock<AuditLogger>();

        connRepo.findById.mockResolvedValue(null);

        const useCase = new DisconnectBankUseCase(connRepo, registry, auditLogger);

        await expect(
          useCase.execute({
            connectionId: CONN_ID_B,
            householdId: HOUSEHOLD_A,
            userId: USER_A,
          }),
        ).rejects.toThrow(BankConnectionNotFoundError);

        expect(connRepo.markDisconnected).not.toHaveBeenCalled();
      });

      it('throws BankConnectionForbiddenError when userId does not match connection owner', async () => {
        const connRepo = mock<BankConnectionRepository>();
        const registry = mock<BankConnectorRegistry>();
        const auditLogger = mock<AuditLogger>();
        // Connection found (correct household) but owned by USER_B
        const connOwnedByB = makeBankConnection(HOUSEHOLD_A, { userId: USER_B });
        connRepo.findById.mockResolvedValue(connOwnedByB);

        const useCase = new DisconnectBankUseCase(connRepo, registry, auditLogger);

        await expect(
          useCase.execute({
            connectionId: CONN_ID_A,
            householdId: HOUSEHOLD_A,
            userId: USER_A,
          }),
        ).rejects.toThrow(BankConnectionForbiddenError);

        expect(connRepo.markDisconnected).not.toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Plans — CreatePlan, UpdatePlan, GetPlanDashboard, AddPlannedItem,
  //         UpdatePlannedItem
  // ---------------------------------------------------------------------------

  describe('plans — extended use cases', () => {
    describe('CreatePlanUseCase', () => {
      it('creates plan with the supplied householdId', async () => {
        const planRepo = mock<PlanRepository>();
        const auditLog = mock<AuditLogPort>();
        const planA = makePlan(HOUSEHOLD_A);

        planRepo.listActive.mockResolvedValue([]);
        planRepo.create.mockResolvedValue(planA);
        auditLog.record.mockResolvedValue(undefined);

        const useCase = new CreatePlanUseCase(planRepo, auditLog, () => VALID_UUID);
        const result = await useCase.execute({
          name: 'Jan Plan',
          type: 'personal',
          periodKind: 'monthly',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
          baseCurrency: 'EUR',
          userId: USER_A,
          householdId: HOUSEHOLD_A,
        });

        expect(result.householdId).toBe(HOUSEHOLD_A);
        expect(planRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('passes correct householdId to listActive when checking duplicates', async () => {
        const planRepo = mock<PlanRepository>();
        const auditLog = mock<AuditLogPort>();
        const planA = makePlan(HOUSEHOLD_A);

        planRepo.listActive.mockResolvedValue([]);
        planRepo.create.mockResolvedValue(planA);
        auditLog.record.mockResolvedValue(undefined);

        const useCase = new CreatePlanUseCase(planRepo, auditLog, () => VALID_UUID);
        await useCase.execute({
          name: 'Jan Plan',
          type: 'personal',
          periodKind: 'monthly',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
          baseCurrency: 'EUR',
          userId: USER_A,
          householdId: HOUSEHOLD_A,
        });

        expect(planRepo.listActive).toHaveBeenCalledWith(
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });
    });

    describe('UpdatePlanUseCase', () => {
      it('updates plan within the correct household scope', async () => {
        const planRepo = mock<PlanRepository>();
        const auditLog = mock<AuditLogPort>();
        const planA = makePlan(HOUSEHOLD_A);
        const updatedPlan = { ...planA, name: 'Updated Plan' };

        planRepo.findById.mockResolvedValue(planA);
        planRepo.update.mockResolvedValue(updatedPlan);
        auditLog.record.mockResolvedValue(undefined);

        const useCase = new UpdatePlanUseCase(planRepo, auditLog);
        const result = await useCase.execute({
          planId: PLAN_ID_A,
          patch: { name: 'Updated Plan' },
          userId: USER_A,
          householdId: HOUSEHOLD_A,
        });

        expect(result.householdId).toBe(HOUSEHOLD_A);
        expect(planRepo.findById).toHaveBeenCalledWith(
          PLAN_ID_A,
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
        expect(planRepo.update).toHaveBeenCalledWith(
          PLAN_ID_A,
          expect.anything(),
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('throws when plan belongs to household B (repo returns null in scope A)', async () => {
        const planRepo = mock<PlanRepository>();
        const auditLog = mock<AuditLogPort>();

        planRepo.findById.mockResolvedValue(null);

        const useCase = new UpdatePlanUseCase(planRepo, auditLog);

        await expect(
          useCase.execute({
            planId: PLAN_ID_B,
            patch: { name: 'Hacked' },
            userId: USER_A,
            householdId: HOUSEHOLD_A,
          }),
        ).rejects.toThrow(/PLAN_NOT_FOUND/);

        expect(planRepo.update).not.toHaveBeenCalled();
      });
    });

    describe('GetPlanDashboardUseCase', () => {
      it('returns dashboard for plan in the correct household', async () => {
        const planRepo = mock<PlanRepository>();
        const actualsReader = mock<PlanActualsReader>();
        const planA = makePlan(HOUSEHOLD_A);
        const view = makePlanActualsView(PLAN_ID_A);

        planRepo.findById.mockResolvedValue(planA);
        actualsReader.read.mockResolvedValue(view);

        const useCase = new GetPlanDashboardUseCase(planRepo, actualsReader);
        const result = await useCase.execute({
          planId: PLAN_ID_A,
          householdId: HOUSEHOLD_A,
          asOf: new Date('2024-01-15'),
        });

        expect(result.planId).toBe(PLAN_ID_A);
        expect(planRepo.findById).toHaveBeenCalledWith(
          PLAN_ID_A,
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('throws when plan belongs to household B (repo returns null in scope A)', async () => {
        const planRepo = mock<PlanRepository>();
        const actualsReader = mock<PlanActualsReader>();

        planRepo.findById.mockResolvedValue(null);

        const useCase = new GetPlanDashboardUseCase(planRepo, actualsReader);

        await expect(
          useCase.execute({
            planId: PLAN_ID_B,
            householdId: HOUSEHOLD_A,
            asOf: new Date('2024-01-15'),
          }),
        ).rejects.toThrow(/PLAN_NOT_FOUND/);

        expect(actualsReader.read).not.toHaveBeenCalled();
      });
    });

    describe('AddPlannedItemUseCase', () => {
      it('adds planned item only when plan belongs to the requesting household', async () => {
        const planRepo = mock<PlanRepository>();
        const plannedItemRepo = mock<PlannedItemRepository>();
        const planA = makePlan(HOUSEHOLD_A);
        const itemA = makePlannedItem(HOUSEHOLD_A);

        planRepo.findById.mockResolvedValue(planA);
        plannedItemRepo.add.mockResolvedValue(itemA);

        const useCase = new AddPlannedItemUseCase(planRepo, plannedItemRepo, () => VALID_UUID);
        const result = await useCase.execute({
          planId: PLAN_ID_A,
          categoryId: CATEGORY_ID,
          direction: 'expense',
          amount: { amountMinor: 500n, currency: 'EUR' },
          userId: USER_A,
          householdId: HOUSEHOLD_A,
        });

        expect(result.householdId).toBe(HOUSEHOLD_A);
        expect(planRepo.findById).toHaveBeenCalledWith(
          PLAN_ID_A,
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('throws when plan belongs to household B', async () => {
        const planRepo = mock<PlanRepository>();
        const plannedItemRepo = mock<PlannedItemRepository>();

        planRepo.findById.mockResolvedValue(null);

        const useCase = new AddPlannedItemUseCase(planRepo, plannedItemRepo, () => VALID_UUID);

        await expect(
          useCase.execute({
            planId: PLAN_ID_B,
            categoryId: CATEGORY_ID,
            direction: 'expense',
            amount: { amountMinor: 500n, currency: 'EUR' },
            userId: USER_A,
            householdId: HOUSEHOLD_A,
          }),
        ).rejects.toThrow(/PLAN_NOT_FOUND/);

        expect(plannedItemRepo.add).not.toHaveBeenCalled();
      });
    });

    describe('UpdatePlannedItemUseCase', () => {
      it('updates item only when plan belongs to the requesting household', async () => {
        const planRepo = mock<PlanRepository>();
        const plannedItemRepo = mock<PlannedItemRepository>();
        const auditLog = mock<AuditLogPort>();
        const planA = makePlan(HOUSEHOLD_A);
        const itemA = makePlannedItem(HOUSEHOLD_A);
        const updatedItem = { ...itemA, amount: { amountMinor: 800n, currency: 'EUR' } };

        planRepo.findById.mockResolvedValue(planA);
        plannedItemRepo.update.mockResolvedValue(updatedItem);
        auditLog.record.mockResolvedValue(undefined);

        const useCase = new UpdatePlannedItemUseCase(planRepo, plannedItemRepo, auditLog);
        const result = await useCase.execute({
          planId: PLAN_ID_A,
          itemId: PLANNED_ITEM_ID,
          patch: { amount: { amountMinor: 800n, currency: 'EUR' } },
          userId: USER_A,
          householdId: HOUSEHOLD_A,
        });

        expect(result.householdId).toBe(HOUSEHOLD_A);
        expect(planRepo.findById).toHaveBeenCalledWith(
          PLAN_ID_A,
          expect.objectContaining({ householdId: HOUSEHOLD_A }),
        );
      });

      it('throws when plan belongs to household B', async () => {
        const planRepo = mock<PlanRepository>();
        const plannedItemRepo = mock<PlannedItemRepository>();
        const auditLog = mock<AuditLogPort>();

        planRepo.findById.mockResolvedValue(null);

        const useCase = new UpdatePlannedItemUseCase(planRepo, plannedItemRepo, auditLog);

        await expect(
          useCase.execute({
            planId: PLAN_ID_B,
            itemId: PLANNED_ITEM_ID,
            patch: { amount: { amountMinor: 800n, currency: 'EUR' } },
            userId: USER_A,
            householdId: HOUSEHOLD_A,
          }),
        ).rejects.toThrow(/PLAN_NOT_FOUND/);

        expect(plannedItemRepo.update).not.toHaveBeenCalled();
      });
    });
  });
});
