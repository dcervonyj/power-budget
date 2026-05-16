import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectionRepository, BankConnectorRegistry, BankSyncQueuePort } from '../../src/bank/domain/ports.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
} from '../../src/bank/domain/errors.js';
import { ListUserConnectionsUseCase } from '../../src/bank/application/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../src/bank/application/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../src/bank/application/use-cases/DisconnectBankUseCase.js';
import type { AuditLogger } from '../../src/audit/domain/ports.js';
import {
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  USER_A,
  USER_B,
  CONN_ID_A,
  CONN_ID_B,
  makeBankConnection,
} from './helpers.js';

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
});
