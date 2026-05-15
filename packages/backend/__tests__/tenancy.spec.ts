import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectionId, HouseholdId, PlanId, UserId } from '@power-budget/core';
import type { BankConnectionRepository } from '../src/domain/bank/ports.js';
import type { BankConnection } from '../src/domain/bank/entities.js';
import { ListUserConnectionsUseCase } from '../src/application/bank/use-cases/ListUserConnectionsUseCase.js';
import type { PlanRepository } from '../src/domain/plans/ports.js';
import type { Plan } from '../src/domain/plans/entities.js';
import { ListActivePlansUseCase } from '../src/application/plans/use-cases/ListActivePlansUseCase.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOUSEHOLD_A = '01900000-0000-7000-8000-aaaaaaaaaaaa' as HouseholdId;
const HOUSEHOLD_B = '01900000-0000-7000-8000-bbbbbbbbbbbb' as HouseholdId;
const USER_A = '01900000-0000-7000-8000-000000000001' as UserId;

function makeBankConnection(householdId: HouseholdId): BankConnection {
  return {
    id: `conn-${householdId}` as BankConnectionId,
    householdId,
    userId: USER_A,
    provider: 'gocardless',
    bankId: 'TEST_BANK',
    externalConsentRef: null,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };
}

function makePlan(householdId: HouseholdId): Plan {
  return {
    id: `plan-${householdId}` as PlanId,
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
});
