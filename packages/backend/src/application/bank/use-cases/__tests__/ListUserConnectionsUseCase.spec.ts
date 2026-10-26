import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type { BankConnectionRepository } from '../../../../domain/bank/ports.js';
import type { BankConnection } from '../../../../domain/bank/entities.js';
import { ListUserConnectionsUseCase } from '../ListUserConnectionsUseCase.js';

const USER_ID = UserId.of('01900000-0000-7000-8000-000000000001');
const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000002');

function makeConnection(id: string, status: BankConnection['status']): BankConnection {
  return {
    id: BankConnectionId.of(id),
    householdId: HOUSEHOLD_ID,
    userId: USER_ID,
    provider: 'gocardless',
    bankId: 'PKO_PLPKOPPLPW',
    externalConsentRef: `ref-${id}`,
    encryptedConsent: null,
    expiresAt: null,
    status,
    disconnectedAt: null,
    createdAt: new Date('2026-10-26T00:00:00Z'),
  };
}

describe('ListUserConnectionsUseCase', () => {
  it('leaves out pending connections, whose consent never completed (CLN-038)', async () => {
    const active = makeConnection('01900000-0000-7000-8000-000000000003', 'active');
    const disconnected = makeConnection('01900000-0000-7000-8000-000000000004', 'disconnected');
    const pending = makeConnection('01900000-0000-7000-8000-000000000005', 'pending');
    const connectionRepo = mock<BankConnectionRepository>();
    connectionRepo.listByUser.mockResolvedValue([active, pending, disconnected]);

    const result = await new ListUserConnectionsUseCase(connectionRepo).execute({
      userId: USER_ID,
    });

    expect(result).toEqual([active, disconnected]);
    expect(connectionRepo.listByUser).toHaveBeenCalledWith(USER_ID);
  });
});
