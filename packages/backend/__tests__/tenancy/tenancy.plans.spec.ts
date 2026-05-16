import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
  PlanActualsReader,
} from '../../src/plans/domain/ports.js';
import { ListActivePlansUseCase } from '../../src/plans/application/use-cases/ListActivePlansUseCase.js';
import { CreatePlanUseCase } from '../../src/plans/application/use-cases/CreatePlanUseCase.js';
import { UpdatePlanUseCase } from '../../src/plans/application/use-cases/UpdatePlanUseCase.js';
import { GetPlanDashboardUseCase } from '../../src/plans/application/use-cases/GetPlanDashboardUseCase.js';
import { AddPlannedItemUseCase } from '../../src/plans/application/use-cases/AddPlannedItemUseCase.js';
import { UpdatePlannedItemUseCase } from '../../src/plans/application/use-cases/UpdatePlannedItemUseCase.js';
import {
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  USER_A,
  PLAN_ID_A,
  PLAN_ID_B,
  CATEGORY_ID,
  PLANNED_ITEM_ID,
  VALID_UUID,
  makePlan,
  makePlanActualsView,
  makePlannedItem,
} from './helpers.js';

describe('Tenancy isolation — application layer', () => {
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
