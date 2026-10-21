import { describe, expect, it } from 'vitest';
import type { BankConnectionDto } from '@power-budget/shared-app/contract';
import { BankConnectionMapper } from './BankConnectionMapper.js';

const dto: BankConnectionDto = {
  id: 'conn-1',
  householdId: 'hh-1',
  userId: 'user-1',
  provider: 'gocardless',
  bankId: 'PKO_BPKOPLPW',
  status: 'active',
  expiresAt: '2026-12-31T00:00:00.000Z',
  disconnectedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('BankConnectionMapper', () => {
  it('maps the API connection and parses its dates', () => {
    expect(BankConnectionMapper.toBankConnection(dto)).toEqual({
      id: 'conn-1',
      bankId: 'PKO_BPKOPLPW',
      provider: 'gocardless',
      status: 'active',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(BankConnectionMapper.toBankConnection({ ...dto, expiresAt: null }).expiresAt).toBeNull();
  });

  it('asks for a reconnect only for expired or reconnect_required connections', () => {
    const statuses = ['active', 'expired', 'disconnected', 'reconnect_required'] as const;

    expect(
      statuses.map((status) =>
        BankConnectionMapper.needsReconnect(
          BankConnectionMapper.toBankConnection({ ...dto, status }),
        ),
      ),
    ).toEqual([false, true, false, true]);
  });
});
