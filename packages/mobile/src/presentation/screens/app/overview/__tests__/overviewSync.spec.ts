import { describe, expect, it } from 'vitest';
import type { AccountDto, BankConnectionDto } from '@power-budget/shared-app/contract';
import { summariseSync } from '../overviewSync.js';

const NOW = new Date('2026-10-22T13:00:00.000Z');

function connection(id: string, status: BankConnectionDto['status']): BankConnectionDto {
  return {
    id,
    householdId: 'household-1',
    userId: 'user-1',
    provider: 'gocardless',
    bankId: 'PKO_BPKOPLPW',
    status,
    expiresAt: null,
    disconnectedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

function account(id: string, connectionId: string, lastSyncedAt: string | null): AccountDto {
  return {
    id,
    kind: 'bank',
    name: 'PKO BP',
    currency: 'PLN',
    connectionId,
    balance: null,
    lastSyncedAt,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('summariseSync', () => {
  it('shows no chip without a live connection', () => {
    expect(summariseSync([], [], NOW)).toBeNull();
    expect(summariseSync([connection('c1', 'disconnected')], [], NOW)).toBeNull();
  });

  it('asks to renew when a live connection needs a new consent', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'expired')],
        [account('a1', 'c1', '2026-10-22T12:59:30.000Z')],
        NOW,
      ),
    ).toEqual({ kind: 'renew' });
  });

  it('shows the age of the oldest connection, each as fresh as its newest account', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'active')],
        [
          account('a1', 'c1', '2026-10-22T09:00:00.000Z'),
          account('a2', 'c1', '2026-10-22T12:59:30.000Z'),
          account('a3', 'c2', '2026-10-22T11:00:00.000Z'),
        ],
        NOW,
      ),
    ).toEqual({ kind: 'bank-age', ageMinutes: 120 });
  });

  it('is stale when a live connection has never synced', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'active')],
        [account('a1', 'c1', '2026-10-22T12:59:30.000Z'), account('a2', 'c2', null)],
        NOW,
      ),
    ).toEqual({ kind: 'stale' });
  });
});
