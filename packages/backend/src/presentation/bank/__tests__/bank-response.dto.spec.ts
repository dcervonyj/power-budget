import { describe, it, expect } from 'vitest';
import { BankConnectionId, HouseholdId, UserId, type EncryptedString } from '@power-budget/core';
import type { BankConnection } from '../../../domain/bank/entities.js';
import { toBankConnectionDto } from '../dto/bank-response.dto.js';

const SECRET: EncryptedString = Object.assign('enc:consent-token', {
  __brand: 'EncryptedString' as const,
});

describe('toBankConnectionDto (audit M7)', () => {
  it('drops the encrypted consent and the provider consent ref', () => {
    const connection: BankConnection = {
      id: BankConnectionId.of('01900000-0000-7000-8000-0000000000a2'),
      householdId: HouseholdId.of('01900000-0000-7000-8000-0000000000a1'),
      userId: UserId.of('01900000-0000-7000-8000-00000000000a'),
      provider: 'gocardless',
      bankId: 'PKO_BPKOPLPW',
      externalConsentRef: 'requisition-123',
      encryptedConsent: SECRET,
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      status: 'active',
      disconnectedAt: null,
      createdAt: new Date('2026-10-21T10:00:00.000Z'),
    };

    expect(toBankConnectionDto(connection)).toEqual({
      id: '01900000-0000-7000-8000-0000000000a2',
      householdId: '01900000-0000-7000-8000-0000000000a1',
      userId: '01900000-0000-7000-8000-00000000000a',
      provider: 'gocardless',
      bankId: 'PKO_BPKOPLPW',
      status: 'active',
      expiresAt: '2026-12-01T00:00:00.000Z',
      disconnectedAt: null,
      createdAt: '2026-10-21T10:00:00.000Z',
    });
  });
});
