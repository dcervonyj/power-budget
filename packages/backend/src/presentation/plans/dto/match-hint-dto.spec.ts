import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { matchHintFromDto, toMatchHintDto } from './plans.dto.js';

describe('matchHintFromDto', () => {
  it('maps a full hint to bigint minor units and round-trips', () => {
    const hint = matchHintFromDto({
      counterpartyPattern: ' Landlord ',
      amountMinor: '340000',
      toleranceMinor: '500',
      dayOfMonth: 5,
      dayWindow: 2,
    });

    expect(hint).toEqual({
      counterpartyPattern: 'Landlord',
      amount: { amountMinor: 340000n, toleranceMinor: 500n },
      day: { dayOfMonth: 5, window: 2 },
    });
    expect(toMatchHintDto(hint)).toEqual({
      counterpartyPattern: 'Landlord',
      amountMinor: '340000',
      toleranceMinor: '500',
      dayOfMonth: 5,
      dayWindow: 2,
    });
  });

  it('passes null through to clear the hint', () => {
    expect(matchHintFromDto(null)).toBeNull();
  });

  it('rejects an orphan tolerance or day window', () => {
    expect(() => matchHintFromDto({ counterpartyPattern: 'A', toleranceMinor: '5' })).toThrow(
      BadRequestException,
    );
    expect(() => matchHintFromDto({ counterpartyPattern: 'A', dayWindow: 2 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a hint with no part set', () => {
    expect(() => matchHintFromDto({ counterpartyPattern: '  ' })).toThrow(BadRequestException);
  });
});
